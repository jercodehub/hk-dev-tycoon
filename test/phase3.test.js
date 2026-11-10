import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  UNIT_SPECS,
  affordability,
  campaignHeat,
  chooseContractor,
  chooseLand,
  chooseStory,
  commitSale,
  confirmSettle,
  createCampaign,
  createCampaignCatalog,
  districtFlavour,
  gfaRemaining,
  gfaUsed,
  initialMarket,
  mixFits,
  presetMix,
  priceOffer,
  resolveSale,
  sizePools,
  skipLand,
  unitTotal,
} from "../game/campaign.js";
import { playerFacingCopy } from "../game/copy.js";
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

function projectSale(district, { seed = 1, cheer = 0, showflat = false, leftover = "cut", mix = null, roll = 1, gfaFt2 = 22000 } = {}) {
  const heat = campaignHeat({ completed: 0, seed }, balance);
  const offer = priceOffer(
    { slot: "A", type: "gov", district, gfaFt2, premium: 1 },
    initialMarket(),
    catalog,
    heat,
  );
  const contractor = { id: "huimen", quality: 1, leak: 0.12, collapsed: false, total: offer.estBuildTotal };
  const state = {
    seed,
    completed: 0,
    reputation: 58,
    market: initialMarket(),
    poolBias: {},
    project: { offer, contractor, mix: mix || offer.mixHint, saleRoll: roll },
  };
  return resolveSale(catalog, state, { showflat, cheer, leftover, roll });
}

test("unit areas and slider GFA block an over-allocation", () => {
  assert.deepEqual(UNIT_SPECS.map((spec) => spec.ft2), [280, 350, 450, 600, 1000]);
  const mix = { studio: 2, one: 1, two: 1, three: 1, feature: 1 };
  assert.equal(gfaUsed(mix), 2 * 280 + 350 + 450 + 600 + 1000);
  assert.equal(gfaRemaining(3000, mix), 40);
  assert.equal(mixFits(2960, mix), true);
  assert.equal(mixFits(2959, mix), false);
  assert.equal(unitTotal(mix), 6);
  const preset = presetMix(22000, "uni", "spicy", balance);
  assert.ok(gfaUsed(preset) > 0);
  assert.ok(gfaUsed(preset) <= 22000);
  assert.ok(preset.studio > presetMix(22000, "core", "spicy", balance).studio);
  assert.ok(presetMix(50000, "starter", "loose", balance).two > presetMix(50000, "core", "loose", balance).two);
  assert.ok(presetMix(50000, "core", "loose", balance).feature > presetMix(50000, "starter", "loose", balance).feature);

  let state = start(8);
  state = chooseLand(catalog, state, "A").state;
  const over = chooseContractor(catalog, state, "huimen", { studio: 400, one: 0, two: 0, three: 0, feature: 0 });
  assert.equal(over.ok, false);
  assert.equal(over.error, "over_gfa");
  assert.equal(state.phase, "build");
  const empty = chooseContractor(catalog, state, "huimen", { studio: 0, one: 0, two: 0, three: 0, feature: 0 });
  assert.equal(empty.error, "empty_mix");
  const one = chooseContractor(catalog, state, "huimen", { studio: 1, one: 0, two: 0, three: 0, feature: 0 });
  assert.equal(one.ok, true);
  assert.equal(one.state.project.mix.studio, 1);
});

test("spicy and loose heat resize pools, and the chip flips every three projects", () => {
  assert.equal(campaignHeat({ completed: 0, seed: 2 }, balance), "loose");
  assert.equal(campaignHeat({ completed: 2, seed: 2 }, balance), "loose");
  assert.equal(campaignHeat({ completed: 3, seed: 2 }, balance), "spicy");
  assert.equal(campaignHeat({ completed: 5, seed: 2 }, balance), "spicy");
  assert.equal(campaignHeat({ completed: 6, seed: 2 }, balance), "loose");
  assert.equal(campaignHeat({ completed: 0, seed: 1 }, balance), "spicy");
  const loose = sizePools(catalog, { gfaFt2: 40000, flavour: "uni", heat: "loose" });
  const spicy = sizePools(catalog, { gfaFt2: 40000, flavour: "uni", heat: "spicy" });
  assert.ok(loose.whale > spicy.whale);
  assert.ok(spicy.starter > loose.starter);
  assert.ok(spicy.couple > loose.couple);
});

test("district tags shift the pools they describe", () => {
  assert.equal(districtFlavour("沙田區", balance), "uni");
  assert.equal(districtFlavour("北區", balance), "starter");
  assert.equal(districtFlavour("中西區", balance), "core");
  assert.equal(districtFlavour("西貢區", balance), "core");
  const uni = sizePools(catalog, { gfaFt2: 40000, flavour: "uni", heat: "loose" });
  const remote = sizePools(catalog, { gfaFt2: 40000, flavour: "starter", heat: "loose" });
  const core = sizePools(catalog, { gfaFt2: 40000, flavour: "core", heat: "loose" });
  assert.ok(uni.whale > remote.whale);
  assert.ok(remote.starter > uni.starter);
  assert.ok(remote.feature < core.feature);
  assert.ok(core.upgrader > remote.upgrader);
  const state = start(4);
  assert.equal(state.offers[0].district, "沙田區");
  assert.equal(state.offers[0].flavour, "uni");
  assert.ok(state.offers.every((offer) => ["uni", "starter", "core"].includes(offer.flavour)));
});

test("sales deplete the matching pool", () => {
  const sale = projectSale("沙田區", { seed: 2, mix: { studio: 8, one: 4, two: 4, three: 1, feature: 0 } });
  assert.ok(sale.byType.studio.sold > 0);
  assert.equal(sale.poolsAfter.whale, sale.poolsBefore.whale - sale.byType.studio.sold);
  assert.equal(sale.poolsAfter.couple, sale.poolsBefore.couple - sale.byType.one.sold);
  assert.equal(sale.poolsAfter.starter, sale.poolsBefore.starter - sale.byType.two.sold);
  assert.equal(sale.poolsAfter.upgrader, sale.poolsBefore.upgrader - sale.byType.three.sold);
  assert.ok(sale.poolsAfter.whale < sale.poolsBefore.whale);
});

test("the starter bowl cracks on a dear lump sum and cheer can mend a close call", () => {
  const gains = balance.cheerBowl;
  assert.equal(affordability({ lump: 100, budget: 100, cheer: 0, gains }).ok, true);
  assert.equal(affordability({ lump: 105, budget: 100, cheer: 0, gains }).ok, false);
  assert.equal(affordability({ lump: 105, budget: 100, cheer: 1, gains }).ok, true);
  assert.equal(affordability({ lump: 130, budget: 100, cheer: 3, gains }).ok, false);
  const shaTin = projectSale("沙田區", { seed: 1, cheer: 0 });
  const east = projectSale("東區", { seed: 1, cheer: 0 });
  const eastTwo = projectSale("東區", { seed: 1, cheer: 2 });
  const eastThree = projectSale("東區", { seed: 1, cheer: 3 });
  const central = projectSale("中西區", { seed: 1, cheer: 3 });
  assert.equal(shaTin.bowl.ok, true);
  assert.equal(east.bowl.ok, false);
  assert.equal(eastTwo.bowl.ok, false);
  assert.equal(eastThree.bowl.ok, true);
  assert.equal(central.bowl.ok, false);
  assert.ok(eastThree.bowl.bowl > east.bowl.bowl);
  assert.ok(central.bowl.lump > shaTin.bowl.lump);
  assert.ok(east.byType.two.convert < shaTin.byType.two.convert);
});

test("show flat costs cash and lifts 3-bed and feature conversion more than studios", () => {
  const off = projectSale("沙田區", { seed: 2, showflat: false });
  const on = projectSale("沙田區", { seed: 2, showflat: true });
  assert.equal(off.showflatCost, 0);
  assert.ok(on.showflatCost > 0);
  const threeLift = on.byType.three.convert - off.byType.three.convert;
  const featureLift = on.byType.feature.convert - off.byType.feature.convert;
  const studioLift = on.byType.studio.convert - off.byType.studio.convert;
  assert.ok(threeLift > studioLift);
  assert.ok(featureLift > studioLift);
  const d1 = projectSale("沙田區", { seed: 1, cheer: 1 }).byType.one.convert - projectSale("沙田區", { seed: 1, cheer: 0 }).byType.one.convert;
  const d3 = projectSale("沙田區", { seed: 1, cheer: 3 }).byType.one.convert - projectSale("沙田區", { seed: 1, cheer: 2 }).byType.one.convert;
  assert.ok(d1 > d3);
});

test("wrong mix leaves stock that can be cut now or frozen into the next project", () => {
  const mix = { studio: 0, one: 0, two: 0, three: 0, feature: 10 };
  const cut = projectSale("北區", { seed: 2, mix, leftover: "cut" });
  const hold = projectSale("北區", { seed: 2, mix, leftover: "hold" });
  assert.ok(cut.unsold >= 8);
  assert.ok(cut.fireNet > 0);
  assert.equal(cut.frozenAmount, 0);
  assert.equal(hold.fireNet, 0);
  assert.ok(hold.frozenAmount > cut.fireNet);
  assert.equal(cut.partnerShare, 0);

  let state = start(8);
  state = chooseLand(catalog, state, "A").state;
  assert.equal(state.project.offer.type, "gov");
  state = chooseContractor(catalog, state, "huimen", mix).state;
  state = commitSale(catalog, state, { showflat: false, cheer: 0, leftover: "hold" }).state;
  const frozen = state.project.sale.frozenAmount;
  assert.ok(frozen > 0);
  assert.equal(state.project.sale.partnerShare, 0);
  const cashBeforeRelease = confirmSettle(catalog, state).state;
  assert.equal(cashBeforeRelease.phase, "story");
  const choice = cashBeforeRelease.story.choices[0];
  const afterStory = chooseStory(catalog, cashBeforeRelease, choice.id).state;
  const skipped = confirmSettle(catalog, skipLand(catalog, afterStory).state).state;
  assert.equal(skipped.cash, afterStory.cash + frozen);
});

test("a loose market can send one speculator through two or three studios", () => {
  const mix = { studio: 12, one: 0, two: 0, three: 0, feature: 0 };
  const swept = projectSale("沙田區", { seed: 2, mix, roll: 0 });
  const pair = projectSale("沙田區", { seed: 2, mix, roll: 0.5 });
  const quiet = projectSale("沙田區", { seed: 2, mix, roll: 0.99 });
  const spicy = projectSale("沙田區", { seed: 1, mix, roll: 0 });
  assert.equal(swept.marketHeat, "loose");
  assert.equal(swept.cakeSweep, 3);
  assert.equal(pair.cakeSweep, 2);
  assert.equal(quiet.cakeSweep, 0);
  assert.equal(spicy.marketHeat, "spicy");
  assert.equal(spicy.cakeSweep, 0);
  assert.ok(swept.byType.studio.sold >= swept.cakeSweep);
  assert.equal(swept.poolsAfter.whale, swept.poolsBefore.whale - swept.byType.studio.sold);
  assert.equal(projectSale("沙田區", { seed: 1 }).byType.studio.sensitive, true);
  assert.equal(projectSale("沙田區", { seed: 2 }).whaleSensitive, false);
  assert.equal(projectSale("北區", { seed: 1 }).byType.studio.sensitive, false);
});

test("government land skims nothing and draws more controversy than a skip", () => {
  assert.equal(balance.landTypes.gov.partnerRate, 0);
  assert.ok(balance.landTypes.ura.partnerRate > balance.landTypes.mtr.partnerRate);
  assert.ok(balance.landTypes.mtr.partnerRate > 0);
  const gov = projectSale("沙田區", { seed: 2 });
  assert.equal(gov.partnerShare, 0);
  const levels = initialMarket();
  const base = priceOffer({ slot: "A", type: "ura", district: "荃灣區", gfaFt2: 30000, premium: 1 }, levels, catalog, "loose");
  const contractor = { id: "huimen", quality: 1, leak: 0, collapsed: false, total: base.estBuildTotal };
  const ura = resolveSale(catalog, {
    seed: 2,
    completed: 0,
    reputation: 58,
    market: levels,
    poolBias: {},
    project: { offer: { ...base, partnerRate: balance.landTypes.ura.partnerRate }, contractor, saleRoll: 1 },
  }, { leftover: "cut" });
  assert.ok(ura.partnerShare > 0);

  function rate(kind) {
    let hits = 0;
    const samples = 80;
    for (let seed = 1; seed <= samples; seed += 1) {
      let state = start(seed);
      if (kind === "gov") {
        state = chooseLand(catalog, state, "A").state;
        state = chooseContractor(catalog, state, "huimen").state;
        state = commitSale(catalog, state, { showflat: false, cheer: 0, leftover: "cut" }).state;
      } else {
        state = skipLand(catalog, state).state;
      }
      state = confirmSettle(catalog, state).state;
      if (state.story.controversy) hits += 1;
    }
    return hits / samples;
  }
  assert.ok(rate("gov") > rate("skip") + 0.12);
});

test("side stories move reputation, cash, and a buyer pool", () => {
  assert.ok(STORIES.length >= 6 && STORIES.length <= 10);
  const ballot = STORIES.find((story) => story.id === "ballot");
  const choice = ballot.choices.find((item) => item.id === "b");
  assert.ok(choice.rep < 0);
  assert.ok(choice.cash > 0);
  assert.equal(choice.pool.starter, -2);
  let state = start(6);
  state = confirmSettle(catalog, skipLand(catalog, state).state).state;
  state.story = {
    id: ballot.id,
    tc: ballot.tc,
    en: ballot.en,
    controversy: false,
    choices: ballot.choices.map((item) => ({ ...item, pool: item.pool ? { ...item.pool } : undefined })),
  };
  const cash = state.cash;
  const rep = state.reputation;
  const next = chooseStory(catalog, state, "b").state;
  assert.equal(next.cash, cash + choice.cash);
  assert.equal(next.reputation, rep + choice.rep);
  assert.equal(next.poolBias.starter, -2);
  assert.equal(next.flags.stop_while_ahead, true);
  const plain = sizePools(catalog, { gfaFt2: 40000, flavour: "starter", heat: "loose", bias: {} });
  const nudged = sizePools(catalog, { gfaFt2: 40000, flavour: "starter", heat: "loose", bias: next.poolBias });
  assert.equal(nudged.starter, plain.starter - 2);
});

test("a full 20-project run still closes", () => {
  let state = start(21);
  let guard = 0;
  while (state.phase !== "summary" && guard < 400) {
    guard += 1;
    if (state.phase === "story") state = chooseStory(catalog, state, state.story.choices[0].id).state;
    else if (state.phase === "land") {
      const affordable = [...state.offers].sort((a, b) => a.landTotal - b.landTotal);
      if (affordable[0].landTotal <= state.cash) state = chooseLand(catalog, state, affordable[0].slot).state;
      else state = skipLand(catalog, state).state;
    } else if (state.phase === "build") state = chooseContractor(catalog, state, "huimen").state;
    else if (state.phase === "sell") state = commitSale(catalog, state, { showflat: false, cheer: 0, leftover: "cut" }).state;
    else if (state.phase === "settle") state = confirmSettle(catalog, state).state;
    else throw new Error(`stuck in ${state.phase}`);
  }
  assert.equal(state.phase, "summary");
  assert.equal(state.completed, 20);
  assert.equal(state.history.length, 20);
  assert.ok(state.unitsSold > 0);
});

test("player-facing copy does not print banned labels", () => {
  const files = ["../game/main.js", "../game/copy.js", "../game/stories.js"];
  const blob = [
    ...playerFacingCopy(),
    ...STORIES.flatMap((story) => [story.tc, story.en, ...story.choices.flatMap((choice) => [choice.tc, choice.en])]),
    ...files.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")),
  ].join("\n");
  const banned = [
    "開放數據",
    "Open data",
    "遊戲數值",
    "Game economy",
    "舊版存檔",
    "previous save was reset",
    "重新開始",
    "印花稅",
    "辣招",
    "stamp duty",
    "SSD",
    "BSD",
  ];
  for (const phrase of banned) assert.equal(blob.includes(phrase), false, phrase);
});
