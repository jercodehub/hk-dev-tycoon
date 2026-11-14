import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  UNIT_SPECS,
  affordability,
  campaignHeat,
  chooseContractor,
  chooseLand,
  chooseRemedy,
  chooseStory,
  commitSale,
  confirmSettle,
  createCampaign,
  createCampaignCatalog,
  defaultProjectName,
  districtFlavour,
  emptyVoice,
  gfaRemaining,
  gfaUsed,
  heatProjectsLeft,
  hydrateCampaign,
  initialMarket,
  marketComment,
  migrateSave,
  mixFits,
  presetMix,
  priceOffer,
  pushVoice,
  renameProject,
  resolveSale,
  canAddUnit,
  commentForPhase,
  explainForecastGap,
  mixPreset,
  popularityNote,
  saleForecast,
  saleReveal,
  serializeCampaign,
  sizePools,
  skipLand,
  unitPopularity,
  unitTotal,
  voiceComment,
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

function projectContext(district, { seed = 1, mix = null, roll = 1, gfaFt2 = 22000 } = {}) {
  const heat = campaignHeat({ completed: 0, seed }, balance);
  const offer = priceOffer(
    { slot: "A", type: "gov", district, gfaFt2, premium: 1 },
    initialMarket(),
    catalog,
    heat,
  );
  const contractor = { id: "huimen", quality: 1, leak: 0.12, collapsed: false, total: offer.estBuildTotal };
  return {
    seed,
    completed: 0,
    reputation: 58,
    market: initialMarket(),
    poolBias: {},
    voice: emptyVoice(),
    project: { offer, contractor, mix: mix || offer.mixHint, saleRoll: roll },
  };
}

function projectSale(district, options = {}) {
  const { cheer = 0, showflat = false, leftover = "cut", roll = 1, price = "fair" } = options;
  return resolveSale(catalog, projectContext(district, options), { showflat, cheer, leftover, roll, price });
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

test("spicy and loose heat resize pools, and the chip flips every five projects", () => {
  assert.equal(balance.heatEvery, 5);
  assert.equal(campaignHeat({ completed: 0, seed: 2 }, balance), "loose");
  assert.equal(campaignHeat({ completed: 4, seed: 2 }, balance), "loose");
  assert.equal(campaignHeat({ completed: 5, seed: 2 }, balance), "spicy");
  assert.equal(campaignHeat({ completed: 9, seed: 2 }, balance), "spicy");
  assert.equal(campaignHeat({ completed: 10, seed: 2 }, balance), "loose");
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

test("government land skims nothing and does not pile on controversy", () => {
  assert.equal(balance.landTypes.gov.partnerRate, 0);
  assert.equal(balance.landTypes.gov.profitShareMax, 0);
  assert.ok(balance.landTypes.ura.profitShareMin > balance.landTypes.mtr.profitShareMin);
  assert.ok(balance.landTypes.mtr.profitShareMin > 0);
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
    project: { offer: { ...base, profitShare: 0.35, landTotal: 1000, landPaid: 1000 }, contractor: { ...contractor, total: 1000, cost: 1000 }, saleRoll: 1 },
  }, { leftover: "cut" });
  assert.ok(ura.partnerShare > 0);

  function rate(kind) {
    let hits = 0;
    const samples = 80;
    for (let seed = 1; seed <= samples; seed += 1) {
      let state = start(seed);
      if (kind === "gov") {
        state = chooseLand(catalog, state, "A").state;
        let built = chooseContractor(catalog, state, "huimen");
        if (!built.ok) built = chooseContractor(catalog, state, "huimen", null, "big");
        state = built.state;
        if (state.project.contractor.remedyPending) state = chooseRemedy(catalog, state, "rush").state;
        state = commitSale(catalog, state, { showflat: false, cheer: 0, leftover: "cut" }).state;
      } else {
        state = skipLand(catalog, state).state;
      }
      state = confirmSettle(catalog, state).state;
      if (state.story.controversy) hits += 1;
    }
    return hits / samples;
  }
  assert.equal(balance.govControversyWeight, 1);
  assert.ok(balance.controversyWeight <= 1);
  assert.ok(rate("gov") < rate("skip") + 0.18);
});

test("side stories move reputation, cash, and a buyer pool", () => {
  assert.equal(STORIES.length, 10);
  const loan = STORIES.find((story) => story.id === "loan-guide");
  const choice = loan.choices.find((item) => item.id === "a");
  assert.equal(choice.rep, -3);
  assert.equal(choice.cash, -12000000);
  let state = start(6);
  state = confirmSettle(catalog, skipLand(catalog, state).state).state;
  state.story = {
    id: loan.id,
    tc: loan.tc,
    en: loan.en,
    controversy: true,
    choices: loan.choices.map((item) => ({ ...item, effects: item.effects.map((effect) => ({ ...effect })) })),
  };
  const cash = state.cash;
  const rep = state.reputation;
  const next = chooseStory(catalog, state, "a").state;
  assert.equal(next.cash, cash + choice.cash);
  assert.equal(next.reputation, rep + choice.rep);
  assert.equal(next.flags.loan_lobby, true);
  const talent = STORIES.find((story) => story.id === "talent-gate");
  next.story = {
    id: talent.id,
    tc: talent.tc,
    en: talent.en,
    choices: talent.choices.map((item) => ({ ...item, effects: item.effects.map((effect) => ({ ...effect })) })),
  };
  next.phase = "story";
  const nudgedState = chooseStory(catalog, next, "b").state;
  const plain = sizePools(catalog, { gfaFt2: 40000, flavour: "starter", heat: "loose", bias: {} });
  const nudged = sizePools(catalog, { gfaFt2: 40000, flavour: "starter", heat: "loose", bias: {}, poolMul: { whale: 0.9, couple: 1, starter: 1.12, upgrader: 1, feature: 1 } });
  assert.ok(nudged.starter > plain.starter);
  assert.ok(nudged.whale < plain.whale);
  assert.ok(nudgedState.effects.some((effect) => effect.kind === "pool-local"));
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
    } else if (state.phase === "build") {
      let built = chooseContractor(catalog, state, "huimen");
      if (!built.ok) built = chooseContractor(catalog, state, "huimen", null, "big");
      state = built.state;
    } else if (state.phase === "sell") {
      if (state.project.contractor?.remedyPending) state = chooseRemedy(catalog, state, "rush").state;
      state = commitSale(catalog, state, { showflat: false, cheer: 0, leftover: "cut" }).state;
    }
    else if (state.phase === "settle") state = confirmSettle(catalog, state).state;
    else throw new Error(`stuck in ${state.phase}`);
  }
  assert.equal(state.phase, "summary");
  assert.equal(state.completed, 30);
  assert.equal(state.history.length, 30);
  assert.ok(state.unitsSold > 0);
});

test("asking price moves margin, conversion, the bowl, and the forecast in one direction", () => {
  const mix = { studio: 8, one: 6, two: 6, three: 2, feature: 1 };
  const gfaFt2 = 8 * 280 + 6 * 350 + 6 * 450 + 2 * 600 + 1000;
  const base = { seed: 2, mix, gfaFt2, showflat: false, cheer: 0, leftover: "cut" };
  const cheap = projectSale("東區", { ...base, price: "cheap" });
  const fair = projectSale("東區", { ...base, price: "fair" });
  const dear = projectSale("東區", { ...base, price: "expensive" });
  assert.ok(cheap.byType.two.ask < fair.byType.two.ask);
  assert.ok(fair.byType.two.ask < dear.byType.two.ask);
  assert.ok(cheap.byType.two.convert >= fair.byType.two.convert);
  assert.ok(fair.byType.two.convert >= dear.byType.two.convert);
  assert.ok(cheap.sold >= fair.sold);
  assert.ok(fair.sold >= dear.sold);
  assert.ok(cheap.unsold <= fair.unsold);
  assert.ok(fair.unsold <= dear.unsold);
  assert.ok(dear.bowl.lump > fair.bowl.lump);
  assert.ok(dear.bowl.ratio > fair.bowl.ratio);
  assert.equal(fair.choices.price, "fair");
  assert.equal(dear.choices.askMul, balance.ask.stretch);
  assert.equal(cheap.choices.ask, undefined);

  const state = projectContext("東區", base);
  const cast = (price) => saleForecast(catalog, state, { price, showflat: false, leftover: "cut", roll: 0 });
  const fCheap = cast("cheap");
  const fFair = cast("fair");
  const fDear = cast("expensive");
  assert.ok(fCheap.leftRank <= fFair.leftRank);
  assert.ok(fFair.leftRank <= fDear.leftRank);
  assert.equal(Math.sign(dear.unsold - cheap.unsold), Math.sign(fDear.leftRank - fCheap.leftRank));
  assert.equal(fDear.sold, undefined);
  assert.notEqual(dear.unsold, fDear.leftRank);
  assert.notEqual(cheap.unsold, fCheap.leftRank);
  const fitted = saleForecast(catalog, state, { price: "expensive", showflat: true, leftover: "cut" });
  assert.ok(fitted.leftRank <= fDear.leftRank);

  let flipped = false;
  for (const district of ["沙田區", "東區", "北區", "觀塘區", "葵青區", "荃灣區", "大埔區", "黃大仙區", "中西區"]) {
    const calm = projectSale(district, { seed: 2, price: "fair" });
    const hot = projectSale(district, { seed: 2, price: "expensive" });
    if (calm.bowl.ok && !hot.bowl.ok) flipped = true;
  }
  assert.equal(flipped, true);
});

test("a renamed project stays in the save, and a phase 3 save upgrades", () => {
  let state = start(6);
  state = chooseLand(catalog, state, "A").state;
  assert.equal(state.project.name, defaultProjectName("沙田區", "uni"));
  state = renameProject(catalog, state, "  學舍一號  ").state;
  assert.equal(state.project.name, "學舍一號");
  assert.equal(hydrateCampaign(catalog, serializeCampaign(state)).project.name, "學舍一號");

  const legacy = serializeCampaign(state);
  legacy.v = 3;
  delete legacy.voice;
  delete legacy.project.name;
  const migrated = migrateSave(legacy);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.notice, null);
  assert.equal(migrated.state.v, 8);
  const upgraded = hydrateCampaign(catalog, migrated.state);
  assert.equal(upgraded.cash, state.cash);
  assert.equal(upgraded.phase, "build");
  assert.equal(upgraded.project.name, defaultProjectName(upgraded.project.offer.district, upgraded.project.offer.flavour));
});

test("settled history keeps the name, price, and a market comment", () => {
  let state = start(6);
  state = chooseLand(catalog, state, "A").state;
  state = renameProject(catalog, state, "學舍一號").state;
  state = chooseContractor(catalog, state, "xinjing", { studio: 2, one: 0, two: 2, three: 0, feature: 0 }).state;
  state = commitSale(catalog, state, { price: "cheap", showflat: true, cheer: 0, leftover: "hold" }).state;
  assert.equal(state.project.sale.choices.price, "cheap");
  state = confirmSettle(catalog, state).state;
  const item = state.history[0];
  assert.equal(item.name, "學舍一號");
  assert.equal(item.price, "cheap");
  assert.equal(item.type, "gov");
  assert.equal(item.flavour, "uni");
  assert.equal(item.leftover, "hold");
  assert.equal(typeof item.reputationDelta, "number");
  assert.ok(item.mix.two > 0);
  assert.ok(item.comment);
  assert.equal(state.voice.n, 1);
  const again = hydrateCampaign(catalog, serializeCampaign(state));
  assert.equal(again.history[0].name, "學舍一號");
  assert.equal(again.history[0].price, "cheap");
  assert.equal(again.history[0].comment, item.comment);
  assert.equal(again.voice.n, 1);
  assert.equal(again.history[0].reputationDelta, item.reputationDelta);
});

test("market comments come from price times quality and shift after repeated behaviour", () => {
  assert.equal(marketComment({ price: "cheap", quality: 0.86, unsoldRatio: 0.1 }), "cheapBad");
  assert.equal(marketComment({ price: "expensive", quality: 1.12, unsoldRatio: 0.05 }), "dearGood");
  assert.equal(marketComment({ price: "cheap", quality: 1.16, unsoldRatio: 0 }), "valueGood");
  assert.equal(marketComment({ price: "expensive", quality: 0.9, unsoldRatio: 0.4 }), "dearEmpty");
  let voice = emptyVoice();
  const bad = { price: "cheap", quality: 0.86, unsoldRatio: 0.1 };
  voice = pushVoice(voice, bad);
  assert.notEqual(marketComment({ price: "fair", quality: 1, unsoldRatio: 0 }, voice), "cheapBad");
  voice = pushVoice(voice, bad);
  assert.equal(marketComment({ price: "fair", quality: 1, unsoldRatio: 0 }, voice), "cheapBad");
  assert.equal(voiceComment(voice), "cheapBad");
});

test("the sale stays open until the cheer count is used", () => {
  assert.equal(saleReveal(20, 0, 3).done, false);
  assert.equal(saleReveal(20, 1, 3).done, false);
  assert.equal(saleReveal(20, 2, 3).done, false);
  assert.equal(saleReveal(20, 3, 3).done, true);
  assert.equal(saleReveal(20, 3, 3).cheerLeft, 0);
  assert.ok(saleReveal(20, 2, 3).cheerLeft > 0);
  assert.ok(saleReveal(20, 1, 3).shown > saleReveal(20, 0, 3).shown);
  assert.ok(saleReveal(20, 2, 3).shown > saleReveal(20, 1, 3).shown);
  assert.equal(saleReveal(20, 3, 3).shown, 20);
  assert.equal(heatProjectsLeft({ completed: 0 }, balance), 5);
  assert.equal(heatProjectsLeft({ completed: 2 }, balance), 3);
  assert.equal(heatProjectsLeft({ completed: 4 }, balance), 1);
  assert.equal(heatProjectsLeft({ completed: 5 }, balance), 5);
});

test("forecast percent, promo, and per-type bars share one pre-cheer model", () => {
  const mix = { studio: 8, one: 6, two: 10, three: 4, feature: 2 };
  const gfaFt2 = 8 * 280 + 6 * 350 + 10 * 450 + 4 * 600 + 2 * 1000;
  const state = projectContext("東區", { seed: 2, mix, gfaFt2 });
  const baseChoices = { showflat: false, rebate: "none", adBudget: "none", adTarget: null, leftover: "cut", cheer: 3 };
  const priced = (price, extra = {}) => saleForecast(catalog, state, { ...baseChoices, price, ...extra });
  const cheap = priced("cheap");
  const fair = priced("fair");
  const dear = priced("expensive");
  assert.ok(cheap.pct >= fair.pct);
  assert.ok(fair.pct >= dear.pct);
  assert.equal(cheap.beforeCheer, true);
  assert.equal(dear.sold, undefined);
  const matched = resolveSale(catalog, state, { ...baseChoices, price: "fair", cheer: 0, roll: 1 });
  assert.equal(fair.pct, Math.round((matched.sold / matched.units) * 100));
  assert.equal(fair.bars.two.sold, matched.byType.two.sold);
  assert.equal(fair.bars.feature.offered, 2);

  const rebated = priced("expensive", { rebate: "high" });
  assert.ok(rebated.pct >= dear.pct);
  const rebateSale = resolveSale(catalog, state, { ...baseChoices, price: "expensive", rebate: "high", cheer: 0, roll: 1 });
  assert.ok(rebateSale.rebateCost > 0);
  assert.equal(resolveSale(catalog, state, { ...baseChoices, price: "fair", cheer: 0, roll: 1 }).rebateCost, 0);

  const aimed = priced("fair", { adTarget: "feature", adBudget: "high" });
  const missed = priced("fair", { adTarget: "rent", adBudget: "high" });
  assert.ok(aimed.bars.feature.sold >= fair.bars.feature.sold);
  assert.equal(missed.bars.feature.sold, fair.bars.feature.sold);
  assert.ok(aimed.bars.feature.pct >= fair.bars.feature.pct);
  const featureSale = resolveSale(catalog, state, { ...baseChoices, price: "fair", adTarget: "feature", adBudget: "high", cheer: 0, roll: 1 });
  const rentSale = resolveSale(catalog, state, { ...baseChoices, price: "fair", adTarget: "rent", adBudget: "high", cheer: 0, roll: 1 });
  assert.ok(featureSale.adCost > 0);
  assert.equal(rentSale.adCost, featureSale.adCost);
  assert.ok(rentSale.byType.studio.convert > matched.byType.studio.convert);
  assert.equal(rentSale.byType.feature.convert, matched.byType.feature.convert);

  const mixedPlans = [
    { medium: "online", target: "starter", budget: "low" },
    { medium: "tv", target: "upgrade", budget: "high" },
    { medium: "portal", target: "rent", budget: "low" },
  ];
  const mixed = resolveSale(catalog, state, { ...baseChoices, price: "fair", adPlans: mixedPlans, cheer: 0, roll: 1 });
  assert.ok(mixed.byType.two.convert > matched.byType.two.convert);
  assert.ok(mixed.byType.three.convert > matched.byType.three.convert);
  assert.ok(mixed.byType.studio.convert > matched.byType.studio.convert);
  assert.ok(mixed.adCost > 0);
  const paidMixed = resolveSale(catalog, state, { ...baseChoices, price: "fair", adPlans: mixedPlans.map((plan) => ({ ...plan, paidBudget: plan.budget })), cheer: 0, roll: 1 });
  assert.equal(paidMixed.adCost, 0);

  const studios = { studio: 16, one: 0, two: 0, three: 0, feature: 0 };
  const studioState = projectContext("沙田區", { seed: 2, mix: studios, gfaFt2: 16 * 280 });
  const quiet = saleForecast(catalog, studioState, { price: "fair", showflat: false, leftover: "cut" });
  const wrong = saleForecast(catalog, studioState, { price: "fair", showflat: false, leftover: "cut", adTarget: "feature", adBudget: "high" });
  assert.equal(wrong.pct, quiet.pct);
  assert.equal(wrong.bars.studio.sold, quiet.bars.studio.sold);
  assert.equal(wrong.bars.feature.offered, 0);
  assert.ok(resolveSale(catalog, studioState, { price: "fair", adTarget: "feature", adBudget: "high", cheer: 0, roll: 1 }).adCost > 0);

  const show = priced("expensive", { showflat: true });
  assert.ok(show.pct >= dear.pct);
  assert.ok(show.bars.three.sold >= dear.bars.three.sold);
});

test("a sell-out is not called cleared when leftovers still go to a cut-price sale", () => {
  const state = projectContext("沙田區", { seed: 2 });
  const fair = resolveSale(catalog, state, { price: "fair", cheer: 0, leftover: "cut", roll: 1 });
  if (fair.unsold === 0) assert.equal(fair.outcome, "clear");
  else {
    assert.notEqual(fair.outcome, "clear");
    assert.ok(fair.fireNet > 0);
  }
  const cheap = resolveSale(catalog, state, { price: "cheap", cheer: 0, leftover: "cut", roll: 1 });
  if (cheap.unsold === 0) {
    assert.equal(cheap.outcome, "clear");
    assert.equal(cheap.fireNet, 0);
  }
  assert.equal(cheap.choices.askMul, balance.ask.cheap);
  assert.equal(fair.choices.askMul, balance.ask.market);
  const dear = resolveSale(catalog, state, { price: "expensive", cheer: 0, leftover: "cut", roll: 1 });
  assert.equal(dear.choices.askMul, balance.ask.stretch);
  assert.ok(Math.abs(dear.askPerFt2 / fair.askPerFt2 - balance.ask.stretch) < 0.03);
  assert.ok(cheap.byType.two.ask < fair.byType.two.ask);
  assert.ok(fair.byType.two.ask < dear.byType.two.ask);
});

test("cheer or a speculator explains a forecast miss, and comments stay on this project", () => {
  const mix = { studio: 12, one: 2, two: 4, three: 1, feature: 0 };
  const gfaFt2 = 12 * 280 + 2 * 350 + 4 * 450 + 600;
  const state = projectContext("沙田區", { seed: 2, mix, gfaFt2, roll: 0 });
  const forecast = saleForecast(catalog, state, { price: "fair", showflat: false, leftover: "cut" });
  const cheered = resolveSale(catalog, state, { price: "fair", cheer: 3, leftover: "cut", roll: 0 });
  cheered.forecastPct = forecast.pct;
  const gap = explainForecastGap(forecast.pct, cheered);
  assert.ok(gap);
  assert.ok(gap.actual > gap.forecast);
  assert.ok(gap.reasons.includes("cheer") || gap.reasons.includes("cake"));
  const quiet = resolveSale(catalog, state, { price: "fair", cheer: 0, leftover: "cut", roll: 1 });
  quiet.forecastPct = forecast.pct;
  assert.equal(explainForecastGap(forecast.pct, quiet), null);

  assert.notEqual(marketComment({ price: "expensive", quality: 0.86, unsoldRatio: 0 }), "dearEmpty");
  assert.equal(marketComment({ price: "expensive", quality: 0.9, unsoldRatio: 0.4 }), "dearEmpty");
  let voice = emptyVoice();
  voice = pushVoice(voice, { price: "expensive", quality: 0.9, unsoldRatio: 0.4 });
  voice = pushVoice(voice, { price: "expensive", quality: 0.9, unsoldRatio: 0.4 });
  const soldOut = {
    skipped: false,
    contractor: { quality: 1.2, leak: 0, collapsed: false },
    sale: { choices: { price: "cheap", showflat: false }, unsold: 0, units: 8 },
  };
  assert.equal(commentForPhase("settle", soldOut, voice), "valueGood");
  assert.equal(commentForPhase("land", soldOut, voice), voiceComment(voice));
  assert.notEqual(commentForPhase("land", soldOut, voice), "valueGood");
});

test("unit steppers cannot pass GFA, and build popularity is not a sell-through percent", () => {
  for (const name of ["studio", "starter", "upgrade", "luxury"]) {
    const mix = mixPreset(22000, name);
    assert.equal(mixFits(22000, mix), true);
    assert.ok(gfaUsed(mix) > 15000);
    assert.equal(canAddUnit(22000, mix, "feature"), false);
  }
  assert.ok(mixPreset(22000, "studio").studio > mixPreset(22000, "luxury").studio);
  assert.ok(mixPreset(22000, "luxury").feature > mixPreset(22000, "starter").feature);
  assert.ok(mixPreset(22000, "starter").two > mixPreset(22000, "luxury").two);
  assert.ok(mixPreset(22000, "upgrade").three > mixPreset(22000, "studio").three);
  const roomy = { studio: 1, one: 0, two: 0, three: 0, feature: 0 };
  assert.equal(canAddUnit(1000, roomy, "studio"), true);
  assert.equal(canAddUnit(1000, roomy, "feature"), false);
  const pop = unitPopularity("uni", "loose", balance);
  assert.equal(pop.studio.band, "high");
  assert.equal(pop.feature.band, "low");
  assert.equal(popularityNote("uni", "loose", "high"), "近大學＋收租旺");
  assert.equal(popularityNote("uni", "loose", "mid"), "");
  assert.equal(pop.studio.pct, undefined);
});

test("history keeps the contractor and a collapse, and a stalled quote is dearer than the original", () => {
  let collapsed = null;
  for (let seed = 1; seed < 80 && !collapsed; seed += 1) {
    let state = start(seed);
    state = chooseLand(catalog, state, "A").state;
    const picked = chooseContractor(catalog, state, "jingjin");
    if (picked.state.project.contractor.collapsed) collapsed = picked.state;
  }
  assert.ok(collapsed);
  const bill = collapsed.project.contractor;
  assert.ok(bill.extra > 0);
  assert.ok(bill.total > bill.cost);
  assert.ok(bill.total - bill.cost >= bill.extra);
  if (collapsed.project.contractor.remedyPending) collapsed = chooseRemedy(catalog, collapsed, "rush").state;
  collapsed = commitSale(catalog, collapsed, { price: "fair", showflat: false, cheer: 0, leftover: "cut" }).state;
  collapsed = confirmSettle(catalog, collapsed).state;
  assert.equal(collapsed.history[0].collapsed, true);
  assert.equal(collapsed.history[0].contractor, "jingjin");
  assert.equal(collapsed.history[0].quoteCost, bill.cost);
  assert.ok(collapsed.history[0].remedyCost > collapsed.history[0].quoteCost);
  const copy = playerFacingCopy().join("\n");
  assert.equal(copy.includes("拉 bar"), false);
  assert.equal(copy.includes("今次四個選擇"), false);
  assert.equal(copy.includes("打氣剩餘"), false);
  assert.equal(copy.includes("打氣打氣"), false);
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
