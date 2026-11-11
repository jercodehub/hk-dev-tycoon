import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  chooseContractor,
  chooseLand,
  chooseRemedy,
  chooseStory,
  commitSale,
  confirmSettle,
  contractorQuote,
  createCampaign,
  createCampaignCatalog,
  createRng,
  endSummary,
  gameBench,
  hydrateCampaign,
  initialMarket,
  migrateSave,
  normalizeChoices,
  pickDistrict,
  priceOffer,
  priceVerdict,
  projectNumber,
  resolveSale,
  rollCollapse,
  serializeCampaign,
  skipLand,
  tickMarket,
  unitsFromGfa,
} from "../game/campaign.js";

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const balance = load("../game/campaign-balance.json");
const market = load("../data/market-stats.json");
const catalog = createCampaignCatalog({ market, balance });

function start(seed = 7) {
  return createCampaign(catalog, { seed, company: { name: "啟岸發展", logo: "tower", color: "#e2b15a" } });
}

function saleState(offer, contractor, reputation = 58) {
  return {
    reputation,
    market: initialMarket(),
    project: { offer, contractor },
  };
}

test("market tick moves land price, build cost, and buyer power with the property price", () => {
  const up = tickMarket(initialMarket(), 0.05, balance);
  assert.ok(up.price > 1);
  assert.ok(up.land > 1);
  assert.ok(up.build > 1);
  assert.ok(up.buyer > 1);
  assert.ok(up.land - 1 > up.build - 1);
  const down = tickMarket(initialMarket(), -0.05, balance);
  assert.ok(down.price < 1 && down.land < 1 && down.build < 1 && down.buyer < 1);
  const before = gameBench(catalog, "沙田區", initialMarket());
  const after = gameBench(catalog, "沙田區", up);
  assert.ok(after.fairLandPerFt2 > before.fairLandPerFt2);
  assert.ok(after.fairBuildPerFt2 > before.fairBuildPerFt2);
  assert.ok(after.fairSalePerFt2 > before.fairSalePerFt2);
  assert.equal(after.openData.hkdPerM2, before.openData.hkdPerM2);
  assert.equal(after.openData.hkdPerM2, market.prices.averagePrices.areas["新界"].B.value);
});

test("land A/B/C mixes the three land types and skip spends the round without buying", () => {
  const state = start(11);
  assert.deepEqual(state.offers.map((offer) => offer.slot), ["A", "B", "C"]);
  assert.equal(new Set(state.offers.map((offer) => offer.type)).size, 3);
  assert.equal(state.offers[0].type, "gov");
  assert.equal(state.offers[0].district, "沙田區");
  assert.equal(state.offers[0].verdict, "cheap");
  assert.equal(projectNumber(state), 1);
  const skipped = skipLand(catalog, state);
  assert.equal(skipped.ok, true);
  assert.equal(skipped.state.phase, "settle");
  assert.equal(skipped.state.cash, state.cash);
  assert.equal(skipped.state.completed, 0);
  assert.ok(skipped.state.market.step === 1);
  assert.equal(state.phase, "land");
  assert.equal(state.market.step, 0);
  const settled = confirmSettle(catalog, skipped.state);
  assert.equal(settled.state.phase, "story");
  assert.equal(settled.state.completed, 1);
  assert.equal(settled.state.history[0].outcome, "skip");
  assert.ok(settled.state.story.tc.length > 0);
  assert.ok(settled.state.story.en.length > 0);
  const again = chooseStory(catalog, settled.state, settled.state.story.choices[0].id);
  assert.equal(again.state.phase, "land");
  assert.equal(again.state.offers.length, 3);
  assert.equal(new Set(again.state.offers.map((offer) => offer.type)).size, 3);
  assert.equal(projectNumber(again.state), 2);
});

test("district mix follows the land brief: URA always urban, MTR split, government mostly remote", () => {
  const rng = createRng(4);
  let uraUrban = 0;
  let mtrTown = 0;
  let govTown = 0;
  const checks = 400;
  for (let i = 0; i < checks; i += 1) {
    const district = pickDistrict("ura", rng, balance);
    assert.ok(balance.urbanDistricts.includes(district));
    assert.equal(balance.newTownDistricts.includes(district), false);
    if (balance.urbanDistricts.includes(district)) uraUrban += 1;
  }
  for (let i = 0; i < checks; i += 1) {
    const district = pickDistrict("mtr", rng, balance);
    if (balance.newTownDistricts.includes(district)) mtrTown += 1;
  }
  const govRng = createRng(9);
  for (let i = 0; i < checks; i += 1) {
    const district = pickDistrict("gov", govRng, balance);
    if (balance.newTownDistricts.includes(district)) govTown += 1;
  }
  assert.equal(uraUrban, checks);
  assert.ok(mtrTown / checks > 0.35 && mtrTown / checks < 0.65, `MTR new-town share ${mtrTown / checks}`);
  assert.ok(govTown / checks > 0.7 && govTown / checks < 0.9, `government new-town share ${govTown / checks}`);
  const used = new Set(balance.urbanDistricts);
  for (let i = 0; i < 40; i += 1) {
    const district = pickDistrict("ura", rng, balance, used);
    assert.ok(balance.urbanDistricts.includes(district));
    assert.equal(["離島區", "北區", "元朗區", "屯門區", "大埔區", "沙田區", "西貢區", "荃灣區", "葵青區"].includes(district), false);
  }
});

test("GFA becomes a unit count and every offer is judged against the game market", () => {
  assert.equal(unitsFromGfa(22000, balance), Math.round(22000 / balance.areaPerUnitFt2));
  assert.equal(unitsFromGfa(100, balance), balance.minUnits);
  assert.equal(unitsFromGfa(999999, balance), balance.maxUnits);
  assert.equal(priceVerdict(1.2, balance), "expensive");
  assert.equal(priceVerdict(1.08, balance), "expensive");
  assert.equal(priceVerdict(1, balance), "fair");
  assert.equal(priceVerdict(0.94, balance), "fair");
  assert.equal(priceVerdict(0.93, balance), "cheap");
  assert.equal(priceVerdict(0.84, balance), "cheap");
  const state = start(5);
  for (const offer of state.offers) {
    assert.ok(offer.units > 0);
    assert.equal(
      offer.units,
      offer.mixHint.studio + offer.mixHint.one + offer.mixHint.two + offer.mixHint.three + offer.mixHint.feature,
    );
    assert.ok(["expensive", "fair", "cheap"].includes(offer.verdict));
    const spec = balance.landTypes[offer.type];
    if (offer.slot !== "A") {
      assert.ok(offer.gfaFt2 >= spec.gfaMin && offer.gfaFt2 <= spec.gfaMax);
    }
    assert.ok(offer.profitShare >= (spec.profitShareMin ?? 0) - 1e-9);
    assert.ok(offer.profitShare <= (spec.profitShareMax ?? 0) + 1e-9);
    assert.equal(offer.partnerRate, offer.profitShare);
  }
  let sawCheap = false;
  let sawExpensive = false;
  for (let seed = 1; seed <= 16; seed += 1) {
    for (const offer of start(seed).offers) {
      if (offer.verdict === "cheap") sawCheap = true;
      if (offer.verdict === "expensive") sawExpensive = true;
    }
  }
  assert.ok(sawCheap);
  assert.ok(sawExpensive);
});

test("district tiers stay game economy and never pose as official district prices", () => {
  const state = start(2);
  for (const offer of state.offers) {
    assert.equal(offer.officialDistrictPrice, undefined);
    assert.equal(offer.openData.districtPrice, undefined);
    assert.equal(offer.openData.hkdPerM2, market.prices.averagePrices.areas[offer.region][balance.calibrationClass].value);
    assert.notEqual(offer.landPerFt2, offer.openData.hkdPerM2);
    assert.equal(typeof offer.lever, "number");
    assert.ok(offer.lever !== offer.openData.hkdPerM2);
  }
  const island = gameBench(catalog, "中西區", initialMarket());
  const shaTin = gameBench(catalog, "沙田區", initialMarket());
  assert.equal(island.openData.region, "港島");
  assert.equal(shaTin.openData.region, "新界");
  assert.notEqual(island.openData.hkdPerM2, shaTin.openData.hkdPerM2);
  assert.ok(island.fairLandPerFt2 > shaTin.fairLandPerFt2);
  const poisoned = structuredClone(market);
  poisoned.prices.averagePrices.areas["沙田區"] = { B: { value: 1 } };
  assert.throws(() => createCampaignCatalog({ market: poisoned, balance }), /district official prices/);
});

test("buying the tutorial plot locks the land cheque and moves build cost with the market", () => {
  const state = start(8);
  const offer = state.offers[0];
  assert.ok(state.cash > offer.landTotal);
  const broke = { ...state, cash: 0 };
  const denied = chooseLand(catalog, broke, "A");
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "insufficient_cash");
  assert.equal(denied.state, broke);
  const bought = chooseLand(catalog, state, "A");
  assert.equal(bought.ok, true);
  assert.equal(bought.state.cash, state.cash - offer.landTotal);
  assert.equal(bought.state.phase, "build");
  assert.equal(bought.state.project.offer.landTotal, offer.landTotal);
  assert.equal(state.cash, balance.startingCash);
  const quote = contractorQuote(catalog, bought.state, "huimen");
  assert.ok(quote.total > offer.estBuildTotal);
  const cheap = contractorQuote(catalog, bought.state, "jingjin");
  const rich = contractorQuote(catalog, bought.state, "xinjing");
  assert.ok(cheap.total < quote.total);
  assert.ok(quote.total < rich.total);
});

test("cheap contractor can collapse into a dearer replacement; premium contractor does not", () => {
  assert.equal(rollCollapse(balance.contractors.xinjing, 0), false);
  assert.equal(rollCollapse(balance.contractors.jingjin, 0), true);
  assert.equal(rollCollapse(balance.contractors.jingjin, 0.99), false);
  const state = start(8);
  const bought = chooseLand(catalog, state, "A").state;
  let collapsed = null;
  let clean = null;
  for (let seed = 1; seed < 120; seed += 1) {
    const trial = { ...bought, rngCursor: seed >>> 0, cash: bought.cash, reputation: bought.reputation };
    const picked = chooseContractor(catalog, trial, "jingjin");
    assert.equal(picked.ok, true);
    if (picked.state.project.contractor.collapsed && !collapsed) collapsed = picked.state;
    if (!picked.state.project.contractor.collapsed && !clean) clean = picked.state;
    const premium = chooseContractor(catalog, { ...trial, rngCursor: seed >>> 0 }, "xinjing");
    assert.equal(premium.state.project.contractor.collapsed, false);
    assert.equal(premium.state.project.contractor.extra, 0);
  }
  assert.ok(collapsed, "expected a seeded 精盡 collapse");
  assert.ok(clean, "expected a seeded 精盡 build that holds");
  assert.ok(collapsed.project.contractor.extra > 0);
  assert.ok(collapsed.project.contractor.total > clean.project.contractor.total);
  assert.ok(collapsed.project.contractor.repDelta < clean.project.contractor.repDelta);
  assert.ok(collapsed.reputation < clean.reputation);
  assert.equal(collapsed.phase, "sell");
});

test("legacy sale fields no longer set a price, and cheer still clamps", () => {
  const clamped = normalizeChoices({ ask: "steep", agents: "many", cheer: 9 }, balance);
  assert.equal(clamped.cheer, balance.cheerMax);
  assert.equal(clamped.showflat, false);
  assert.equal(clamped.leftover, "cut");
  assert.equal(clamped.ask, undefined);
});

test("partner share skims URA and MTR more than a government tender", () => {
  assert.ok(balance.landTypes.ura.profitShareMin >= balance.landTypes.mtr.profitShareMax);
  assert.ok(balance.landTypes.mtr.profitShareMin > balance.landTypes.gov.profitShareMax);
  const base = priceOffer(
    { slot: "A", type: "gov", district: "荃灣區", gfaFt2: 30000, premium: 1 },
    initialMarket(),
    catalog,
  );
  const contractor = { id: "huimen", quality: 1, leak: 0, collapsed: false, total: base.estBuildTotal };
  const choices = { ask: "market", agents: "one", ads: "web", mix: "blend", rebate: "std", cheer: 1 };
  const cuts = ["gov", "mtr", "ura"].map((type) => {
    const rate = type === "ura" ? 0.4 : type === "mtr" ? 0.2 : 0;
    const offer = { ...base, type, profitShare: rate, landTotal: 1000, landPaid: 1000 };
    const priced = { ...contractor, total: 1000, cost: 1000 };
    return resolveSale(catalog, saleState(offer, priced), choices).partnerShare;
  });
  assert.ok(cuts[2] > cuts[1]);
  assert.ok(cuts[1] > 0);
  assert.equal(cuts[0], 0);
});

test("a sensible first project can profit and the campaign ends on project 20", () => {
  let state = start(21);
  const offer = state.offers.find((item) => item.slot === "A");
  state = chooseLand(catalog, state, offer.slot).state;
  const beforeSaleCash = chooseContractor(catalog, state, "huimen");
  assert.equal(beforeSaleCash.ok, true);
  state = beforeSaleCash.state;
  const choices = { showflat: false, cheer: 1, leftover: "cut" };
  const preview = resolveSale(catalog, state, choices);
  assert.ok(preview.profit > 0, `tutorial path profit ${preview.profit}`);
  const committed = commitSale(catalog, state, choices);
  assert.equal(committed.state.project.sale.profit, preview.profit);
  assert.equal(committed.state.cash, state.cash);
  state = confirmSettle(catalog, committed.state).state;
  assert.equal(state.completed, 1);
  assert.equal(state.phase, "story");
  assert.ok(state.unitsSold > 0);
  assert.equal(state.history[0].profit, preview.profit);

  let guard = 0;
  while (state.phase !== "summary" && guard < 400) {
    guard += 1;
    if (state.phase === "story") {
      state = chooseStory(catalog, state, state.story.choices[0].id).state;
    } else if (state.phase === "land") {
      const affordable = [...state.offers].sort((a, b) => a.landTotal - b.landTotal);
      if (affordable[0].landTotal <= state.cash) state = chooseLand(catalog, state, affordable[0].slot).state;
      else state = skipLand(catalog, state).state;
    } else if (state.phase === "build") {
      let built = chooseContractor(catalog, state, "huimen");
      if (!built.ok) built = chooseContractor(catalog, state, "huimen", null, "big");
      state = built.state;
    } else if (state.phase === "sell") {
      if (state.project.contractor?.remedyPending) state = chooseRemedy(catalog, state, "rush").state;
      state = commitSale(catalog, state, { ask: "market", agents: "one", ads: "none", mix: "blend", rebate: "low", cheer: 0 }).state;
    } else if (state.phase === "settle") {
      state = confirmSettle(catalog, state).state;
    } else {
      throw new Error(`stuck in ${state.phase}`);
    }
  }
  assert.equal(state.phase, "summary");
  assert.equal(state.completed, 30);
  assert.equal(state.history.length, 30);
  assert.equal(projectNumber(state), 30);
  const summary = endSummary(state);
  assert.equal(typeof summary.cash, "number");
  assert.equal(typeof summary.reputation, "number");
  assert.ok(summary.unitsSold > 0);
  assert.ok(summary.reputation >= 0 && summary.reputation <= 100);
  assert.equal(typeof summary.flags, "object");
  assert.ok(state.history.some((item) => item.profit > 0));
  assert.ok(state.history.some((item) => item.profit < 0 || item.skipped));
});

test("thirty passes still close the campaign and a phase 1 save resets", () => {
  let state = start(3);
  for (let i = 0; i < 30; i += 1) {
    assert.equal(state.phase, "land");
    state = skipLand(catalog, state).state;
    state = confirmSettle(catalog, state).state;
    if (state.phase === "story") state = chooseStory(catalog, state, state.story.choices[0].id).state;
  }
  assert.equal(state.phase, "summary");
  assert.equal(state.completed, 30);
  assert.equal(state.unitsSold, 0);
  assert.ok(Object.keys(state.flags).length > 0);
  assert.notEqual(state.market.price, 1);

  const legacy = { v: 1, cash: 10, tick: 2, goals: { mode: "tutorial" }, parcels: [] };
  const migrated = migrateSave(legacy);
  assert.equal(migrated.ok, false);
  assert.equal(migrated.notice, "phase1_reset");
  assert.equal(migrated.state, null);
  assert.equal(migrateSave({ goals: { mode: "free" }, tick: 0 }).notice, "phase1_reset");
  assert.equal(migrateSave(null).notice, null);

  const live = start(6);
  const raw = serializeCampaign(live);
  raw.offers[0].landTotal = 1;
  raw.offers[0].units = 1;
  raw.offers[0].officialDistrictPrice = 999;
  raw.offers[0].partnerRate = 0;
  const restored = hydrateCampaign(catalog, raw);
  assert.equal(restored.offers[0].landTotal, live.offers[0].landTotal);
  assert.equal(restored.offers[0].units, live.offers[0].units);
  assert.equal(restored.offers[0].officialDistrictPrice, undefined);
  assert.equal(restored.offers[0].partnerRate, live.offers[0].partnerRate);
  assert.equal(restored.cash, live.cash);
  const bought = chooseLand(catalog, live, "A").state;
  const built = chooseContractor(catalog, bought, "huimen").state;
  const saved = serializeCampaign(built);
  saved.project.contractor.total = 1;
  saved.project.contractor.extra = 999;
  const back = hydrateCampaign(catalog, saved);
  assert.equal(back.project.contractor.total, built.project.contractor.total);
  assert.equal(back.phase, "sell");
});
