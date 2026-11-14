import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  chooseContractor,
  chooseLand,
  confirmSettle,
  createCampaign,
  createCampaignCatalog,
  PREMIUM_ROUTES,
  premiumGate,
  premiumQuote,
  retryRezoning,
  rollOffers,
  sellBackLand,
  settlePremium,
} from "../game/campaign.js";

const balance = JSON.parse(readFileSync(new URL("../game/campaign-balance.json", import.meta.url), "utf8"));
const market = JSON.parse(readFileSync(new URL("../data/market-stats.json", import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ market, balance });

function richState(seed) {
  const base = createCampaign(catalog, { seed, company: { name: "測試" } });
  const state = {
    ...base,
    completed: 4,
    cash: 5_000_000_000,
    onboarding: { completed: true, step: "done" },
    flags: { ...base.flags, landTender: true },
  };
  return rollOffers(state, catalog);
}

function findPrivate(seedStart = 1, kind = null) {
  for (let seed = seedStart; seed < seedStart + 200; seed += 1) {
    const state = richState(seed);
    const offer = state.offers.find((item) => item.type === "private" && (!kind || item.privateKind === kind));
    if (offer) return { state, offer };
  }
  return null;
}

test("a private plot quotes a premium and blocks the contractor until it is settled", () => {
  const found = findPrivate(1, "industrial");
  assert.ok(found, "expected an industrial plot in rotation");
  const bought = chooseLand(catalog, found.state, found.offer.slot);
  assert.equal(bought.ok, true);
  assert.equal(premiumGate(bought.state), "pending");
  assert.ok(bought.state.project.premium.base > 0);
  const blocked = chooseContractor(catalog, bought.state, "huimen");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "need_premium");
  const quote = premiumQuote(bought.state, "standard");
  const settled = settlePremium(bought.state, "standard");
  assert.equal(settled.ok, true);
  assert.equal(settled.state.cash, bought.state.cash - quote.amount);
  assert.equal(premiumGate(settled.state), null);
  assert.equal(chooseContractor(catalog, settled.state, "huimen").ok, true);
});

test("the standard route is dearer than the base and the deferred route is dearest", () => {
  const found = findPrivate(1, "industrial");
  const bought = chooseLand(catalog, found.state, found.offer.slot).state;
  const base = bought.project.premium.base;
  assert.equal(premiumQuote(bought, "standard").amount, Math.round(base * PREMIUM_ROUTES.standard));
  assert.equal(premiumQuote(bought, "actual").amount, Math.round(base * PREMIUM_ROUTES.actual));
  assert.ok(premiumQuote(bought, "actual").amount > premiumQuote(bought, "standard").amount);
});

test("negotiation stays inside the ±20% band and costs cash up front", () => {
  let seenLow = false;
  let seenHigh = false;
  for (let seed = 1; seed < 60; seed += 1) {
    const found = findPrivate(seed, "industrial");
    if (!found) continue;
    const bought = chooseLand(catalog, found.state, found.offer.slot).state;
    const base = bought.project.premium.base;
    const quote = premiumQuote(bought, "negotiate");
    assert.ok(quote.amount >= Math.round(base * PREMIUM_ROUTES.negotiateMin) - 1);
    assert.ok(quote.amount <= Math.round(base * PREMIUM_ROUTES.negotiateMax) + 1);
    if (quote.amount < base * 0.95) seenLow = true;
    if (quote.amount > base * 1.05) seenHigh = true;
  }
  assert.ok(seenLow && seenHigh, "negotiation should swing both ways");
});

test("the deferred premium is only charged at settlement", () => {
  const found = findPrivate(1, "industrial");
  const bought = chooseLand(catalog, found.state, found.offer.slot).state;
  const quote = premiumQuote(bought, "actual");
  const settled = settlePremium(bought, "actual");
  assert.equal(settled.state.cash, bought.cash);
  assert.equal(settled.state.project.premium.status, "deferred");
  assert.equal(settled.state.project.premium.amount, quote.amount);

  const built = chooseContractor(catalog, settled.state, "huimen", null, "cash");
  assert.equal(built.ok, true);
  const sold = { ...built.state, phase: "settle" };
  sold.project = {
    ...sold.project,
    sale: {
      byType: {},
      netCash: 10_000_000_000,
      revenue: 12_000_000_000,
      profit: 3_000_000_000,
      sold: 100,
      units: 100,
      unsold: 0,
      outcome: "clear",
      reputationDelta: 1,
      marketHeat: 50,
      partnerShare: 0,
      frozenAmount: 0,
      choices: {},
    },
  };
  const done = confirmSettle(catalog, sold);
  assert.equal(done.ok, true);
  assert.ok(done.state.cash <= sold.cash + 10_000_000_000 - quote.amount + 1);
});

test("refused farmland can be retried or sold back at a loss", () => {
  let rejected = null;
  for (let seed = 1; seed < 300 && !rejected; seed += 1) {
    const found = findPrivate(seed, "farm");
    if (!found) continue;
    const bought = chooseLand(catalog, found.state, found.offer.slot);
    if (bought.ok && premiumGate(bought.state) === "rejected") rejected = bought.state;
  }
  assert.ok(rejected, "expected a refused rezoning");

  const before = rejected.cash;
  const retried = retryRezoning(rejected);
  assert.equal(retried.ok, true);
  assert.equal(retried.state.cash, before - Math.round(rejected.project.offer.landPaid * PREMIUM_ROUTES.retryFee));

  const sold = sellBackLand(catalog, rejected);
  assert.equal(sold.ok, true);
  assert.equal(sold.state.phase, "settle");
  assert.equal(sold.state.cash, before + Math.round(rejected.project.offer.landPaid * PREMIUM_ROUTES.sellBack));
  assert.equal(sold.state.project.skipped, true);
  const done = confirmSettle(catalog, sold.state);
  assert.equal(done.ok, true);
});
