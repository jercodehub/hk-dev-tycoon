import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  acknowledgeMismatch,
  addUnits,
  campaignWorth,
  chooseContractor,
  chooseLand,
  chooseRemedy,
  chooseStory,
  commitSale,
  confirmSettle,
  contractorRisk,
  createCampaign,
  createCampaignCatalog,
  formatCount,
  hydrateCampaign,
  migrateSave,
  mixDelta,
  mixPoolGaps,
  mixPreset,
  priceRemedy,
  quoteLoan,
  resolveSale,
  rollSiteTier,
  saleBatches,
  scaleGfa,
  serializeCampaign,
  settleCredit,
  shouldTeachMismatch,
  similarProject,
  sizePools,
  skipLand,
  unitTotal,
} from "../game/campaign.js";
import { STORIES } from "../game/stories.js";

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const balance = load("../game/campaign-balance.json");
const market = load("../data/market-stats.json");
const catalog = createCampaignCatalog({ market, balance });

function start(seed = 7) {
  return createCampaign(catalog, { seed, company: { name: "啟岸發展", logo: "tower", color: "#e2b15a" } });
}

function finishProject(state, loan = "cash") {
  const slot = [...state.offers].sort((a, b) => a.landTotal - b.landTotal)[0];
  let next = chooseLand(catalog, state, slot.slot).state;
  let built = chooseContractor(catalog, next, "huimen", null, loan);
  if (!built.ok) built = chooseContractor(catalog, next, "huimen", null, loan === "cash" ? "big" : "cash");
  next = built.state;
  if (next.project.contractor.remedyPending) next = chooseRemedy(catalog, next, "worse").state;
  next = commitSale(catalog, next, { price: "fair", showflat: false, cheer: 0, leftover: "cut" }).state;
  next = confirmSettle(catalog, next).state;
  if (next.phase === "story") next = chooseStory(catalog, next, next.story.choices[0].id).state;
  return next;
}

test("contractor cards share a leak and collapse scale", () => {
  const cheap = contractorRisk(balance.contractors.jingjin, balance);
  const mid = contractorRisk(balance.contractors.huimen, balance);
  const rich = contractorRisk(balance.contractors.xinjing, balance);
  assert.ok(cheap.leak > mid.leak && mid.leak > rich.leak);
  assert.ok(cheap.collapse > mid.collapse && mid.collapse > rich.collapse);
  assert.equal(rich.collapse, 0);
  assert.ok(cheap.leak <= 1 && cheap.collapse <= 1);
});

test("a collapse offers a dearer rush or a cheaper worse-sales remedy", () => {
  let collapsed = null;
  const bought = chooseLand(catalog, start(8), "A").state;
  for (let seed = 1; seed < 80 && !collapsed; seed += 1) {
    const picked = chooseContractor(catalog, { ...bought, rngCursor: seed >>> 0 }, "jingjin", null, "big");
    if (picked.state.project.contractor.collapsed) collapsed = picked.state;
  }
  assert.ok(collapsed);
  assert.equal(collapsed.project.contractor.remedyPending, true);
  assert.equal(collapsed.phase, "sell");
  const rush = chooseRemedy(catalog, collapsed, "rush").state;
  const worse = chooseRemedy(catalog, collapsed, "worse").state;
  assert.equal(chooseRemedy(catalog, rush, "worse").ok, false);
  assert.ok(worse.project.contractor.extra > 0);
  assert.ok(worse.project.contractor.total > worse.project.contractor.cost);
  assert.ok(rush.project.contractor.total > worse.project.contractor.total);
  assert.ok(worse.cash > rush.cash);
  assert.ok(worse.project.contractor.saleDrag > rush.project.contractor.saleDrag);
  const rushSale = resolveSale(catalog, rush, { price: "fair", cheer: 0, leftover: "cut", roll: 1 });
  const worseSale = resolveSale(catalog, worse, { price: "fair", cheer: 0, leftover: "cut", roll: 1 });
  assert.ok(worseSale.sold <= rushSale.sold);
  const preview = priceRemedy(balance, {
    cost: collapsed.project.contractor.cost,
    id: "jingjin",
    cashBefore: collapsed.project.contractor.cashBefore,
    collapsed: true,
    remedy: "rush",
  });
  assert.equal(rush.project.contractor.extra, preview.extra);
  const settled = confirmSettle(catalog, commitSale(catalog, worse, { price: "fair", cheer: 0, leftover: "cut" }).state).state;
  assert.notEqual(settled.phase, "gameover");
  assert.equal(settled.history[0].collapsed, true);
  assert.ok(settled.history[0].remedyCost > settled.history[0].quoteCost);
});

test("the previous similar project is a pricing hint", () => {
  const both = {
    project: { offer: { flavour: "uni", heat: "loose" } },
    history: [
      { skipped: true },
      { flavour: "core", heat: "spicy", price: "expensive", outcome: "fail", askPerFt2: 100, name: "甲", sold: 1, units: 10 },
      { flavour: "uni", heat: "loose", price: "cheap", outcome: "clear", askPerFt2: 80, name: "學舍", sold: 10, units: 10 },
    ],
  };
  assert.equal(similarProject(both).name, "學舍");
  assert.equal(similarProject(both).price, "cheap");
  assert.equal(similarProject(both).outcome, "clear");
  const flavourOnly = {
    project: { offer: { flavour: "uni", heat: "loose" } },
    history: [
      { flavour: "starter", heat: "loose", price: "fair", outcome: "partial", askPerFt2: 90, name: "丙", sold: 4, units: 8 },
      { flavour: "uni", heat: "spicy", price: "cheap", outcome: "almost", askPerFt2: 70, name: "乙", sold: 9, units: 10 },
    ],
  };
  assert.equal(similarProject(flavourOnly).name, "乙");
  assert.equal(similarProject({ project: { offer: { flavour: "uni", heat: "loose" } }, history: [] }), null);
});

test("stories do not repeat back to back, and none plays more than the cap", () => {
  assert.equal(STORIES.length, 10);
  assert.ok(STORIES.every((story) => story.choices.length === 2));
  let state = start(9);
  while (state.phase !== "summary") {
    if (state.phase === "land") state = skipLand(catalog, state).state;
    else if (state.phase === "settle") state = confirmSettle(catalog, state).state;
    else if (state.phase === "story") state = chooseStory(catalog, state, state.story.choices[0].id).state;
    else throw new Error(state.phase);
  }
  assert.equal(state.storyLog.length, balance.projects - 1);
  for (let i = 1; i < state.storyLog.length; i += 1) {
    assert.notEqual(state.storyLog[i], state.storyLog[i - 1]);
  }
  for (const count of Object.values(state.storyCounts)) assert.ok(count <= balance.storyRepeatCap);
  assert.equal(Object.values(state.storyCounts).reduce((sum, n) => sum + n, 0), balance.projects - 1);
});

test("the first zero-pool mix is taught once", () => {
  let found = null;
  for (const district of ["北區", "離島區", "屯門區"]) {
    const bought = chooseLand(catalog, start(2), "A").state;
    bought.project.offer = { ...bought.project.offer, district, flavour: "starter", gfaFt2: 12000, heat: "spicy" };
    const mix = { studio: 0, one: 0, two: 0, three: 0, feature: 2 };
    const gaps = mixPoolGaps(catalog, bought, mix);
    if (gaps.length) {
      found = { bought, gaps };
      break;
    }
  }
  assert.ok(found, "expected a mix aimed at an empty pool");
  assert.equal(shouldTeachMismatch(found.bought, found.gaps), true);
  const taught = acknowledgeMismatch(found.bought).state;
  assert.equal(taught.flags.mismatchTaught, true);
  assert.equal(shouldTeachMismatch(taught, found.gaps), false);
});

test("credit: interest plus part of the principal survives; two unpaid loans end the run", () => {
  const loan = quoteLoan(100000000, "big", balance);
  assert.ok(loan.principal > quoteLoan(100000000, "small", balance).principal);
  assert.equal(quoteLoan(100000000, "cash", balance).principal, 0);
  const min = Math.max(1, Math.round(loan.principal * balance.credit.minPrincipalFraction));
  const survived = settleCredit(loan.interest + min, loan, { unpaidStreak: 0, carried: 0 }, balance);
  assert.equal(survived.serviced, true);
  assert.equal(survived.unpaid, false);
  assert.equal(survived.gameOver, false);
  assert.equal(survived.yellow, false);
  assert.ok(survived.forgiven > 0);

  const first = settleCredit(1000, loan, { unpaidStreak: 0, carried: 0 }, balance);
  assert.equal(first.unpaid, true);
  assert.equal(first.gameOver, false);
  assert.equal(first.yellow, true);
  assert.ok(first.owed > 0);
  assert.equal(first.cash, balance.credit.survivalCash);

  const cleared = settleCredit(balance.credit.survivalCash, quoteLoan(0, "cash", balance), {
    unpaidStreak: 1,
    carried: first.owed,
  }, balance);
  assert.equal(cleared.gameOver, false);
  assert.equal(cleared.unpaidStreak, 0);

  const second = settleCredit(1000, loan, { unpaidStreak: 1, carried: first.owed }, balance);
  assert.equal(second.unpaid, true);
  assert.equal(second.gameOver, true);

  let state = start(11);
  state = chooseLand(catalog, state, "A").state;
  state = chooseContractor(catalog, state, "huimen", null, "big").state;
  state = commitSale(catalog, state, { price: "fair", cheer: 0, leftover: "cut" }).state;
  state.cash = 1000;
  state.project.sale.netCash = 0;
  const yellow = confirmSettle(catalog, state).state;
  assert.equal(yellow.credit.yellow, true);
  assert.ok(yellow.credit.owed > 0);
  assert.equal(yellow.credit.forceSmall, true);
  assert.notEqual(yellow.phase, "gameover");
  const again = yellow.phase === "story" ? chooseStory(catalog, yellow, yellow.story.choices[0].id).state : yellow;
  assert.ok(again.offers.every((offer) => offer.siteTier === "small" && offer.forcedSmall));
  assert.ok(again.offers.every((offer) => offer.units < 400));
});

test("sites start small, later tiers follow net worth, and 10,000 units are flagship only", () => {
  const opening = start(4);
  assert.ok(opening.offers.every((offer) => offer.siteTier === "small"));
  assert.ok(opening.offers.every((offer) => offer.units < 500));
  assert.equal(rollSiteTier(campaignWorth(opening), opening.seed, 0, balance, false), "small");
  assert.equal(rollSiteTier(9_000_000_000, opening.seed, 1, balance, false), "small");
  assert.equal(rollSiteTier(9_000_000_000, opening.seed, 6, balance, true), "small");
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed += 1) seen.add(rollSiteTier(9_000_000_000, seed, 15, balance, false));
  assert.ok(seen.has("flagship"));
  assert.ok(seen.size > 1);

  const unitsFor = (tier, gfaBase, preset) => unitTotal(mixPreset(scaleGfa(gfaBase, tier, balance, false), preset));
  assert.ok(unitsFor("small", 120000, "studio") < 1000);
  assert.ok(unitsFor("mid", 120000, "studio") < 10000);
  assert.ok(unitsFor("large", 120000, "studio") < 10000);
  assert.ok(unitsFor("flagship", 120000, "studio") >= 10000);
  assert.equal(mixDelta(22000), 1);
  assert.ok(mixDelta(scaleGfa(120000, "large", balance, false)) > 1);
  const bigStep = mixDelta(scaleGfa(120000, "flagship", balance, false));
  const added = addUnits(scaleGfa(120000, "flagship", balance, false), { studio: 0, one: 0, two: 0, three: 0, feature: 0 }, "studio", bigStep);
  assert.equal(added.studio, bigStep);

  const smallPools = sizePools(catalog, { gfaFt2: 22000, flavour: "uni", heat: "loose" });
  const flagshipGfa = scaleGfa(120000, "flagship", balance, false);
  const bigPools = sizePools(catalog, { gfaFt2: flagshipGfa, flavour: "uni", heat: "loose" });
  assert.ok(bigPools.whale > smallPools.whale * 20);
  assert.ok(bigPools.whale > 1000);
  assert.equal(saleBatches(40), null);
  const blocks = saleBatches(12000);
  assert.ok(blocks.blocks >= 4 && blocks.blocks <= 8);
  assert.ok(blocks.per * blocks.blocks >= 12000);
  assert.equal(formatCount(800), "800");
  assert.equal(formatCount(1200), "1.2千");
  assert.equal(formatCount(10000), "1萬");
  assert.equal(formatCount(25000), "2.5萬");
});

test("a new game and a migrated v3 save can finish two small projects without a false game over", () => {
  let state = start(21);
  for (let n = 0; n < 2; n += 1) {
    assert.ok(state.offers.every((offer) => offer.siteTier === "small" && offer.units < 500));
    state = finishProject(state, "cash");
    assert.notEqual(state.phase, "gameover");
  }
  assert.equal(state.completed, 2);
  assert.equal(state.credit.yellow, false);

  const legacy = serializeCampaign(start(6));
  legacy.v = 3;
  delete legacy.voice;
  delete legacy.credit;
  delete legacy.project;
  const migrated = migrateSave(legacy);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.notice, null);
  assert.equal(migrated.state.v, 8);
  let restored = hydrateCampaign(catalog, migrated.state);
  assert.equal(restored.cash, legacy.cash);
  for (let n = 0; n < 2; n += 1) {
    assert.ok(restored.offers.every((offer) => offer.units < 500));
    restored = finishProject(restored, "cash");
    assert.notEqual(restored.phase, "gameover");
  }
  const v4 = serializeCampaign(start(12));
  v4.v = 4;
  delete v4.credit;
  const fromV4 = hydrateCampaign(catalog, migrateSave(v4).state);
  assert.equal(fromV4.cash, v4.cash);
  assert.equal(fromV4.credit.yellow, false);
  assert.equal(finishProject(fromV4).phase === "gameover", false);
});
