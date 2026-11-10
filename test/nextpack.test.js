import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  JV_SHARES,
  bigLoanWarned,
  buildOutlook,
  buildSalesBand,
  campaignWorth,
  celebrateClear,
  chooseContractor,
  chooseLand,
  chooseRemedy,
  chooseStory,
  commitSale,
  confirmSettle,
  contractorQuote,
  createCampaign,
  createCampaignCatalog,
  ensureAffordableOffer,
  fundBuild,
  hydrateCampaign,
  initialMarket,
  jvEligible,
  lapseExit,
  migrateSave,
  mismatchEcho,
  mixPreset,
  pickDistrict,
  presetMix,
  priceOffer,
  projectPresetMix,
  quoteLoan,
  remedyExtra,
  resolveSale,
  rollOffers,
  rollSiteTier,
  saleForecast,
  saleLedger,
  serializeCampaign,
  settlementPreview,
  shouldTeachMismatch,
  acknowledgeMismatch,
  skipLand,
  stakeOf,
  unitRowNote,
  unitTotal,
} from "../game/campaign.js";
import { playerFacingCopy, t } from "../game/copy.js";

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const JV_SHARE = 0.35;
const balance = load("../game/campaign-balance.json");
const market = load("../data/market-stats.json");
const catalog = createCampaignCatalog({ market, balance });

function start(seed = 7) {
  return createCampaign(catalog, { seed, company: { name: "啟岸發展", logo: "tower", color: "#e2b15a" } });
}

function bought(seed = 8, slot = "A") {
  return chooseLand(catalog, start(seed), slot).state;
}

test("loan terms are written in full and self-fund cannot silently overdraft", () => {
  const share = 100000000;
  const ample = fundBuild(balance, { cash: share, cost: share, mode: "big" });
  assert.equal(ample.principal, quoteLoan(share, "big", balance).principal);
  assert.equal(ample.interest, Math.round(ample.principal * ample.rate));
  assert.equal(ample.due, ample.principal + ample.interest);
  assert.ok(ample.principal > fundBuild(balance, { cash: share, cost: share, mode: "small" }).principal);
  assert.equal(fundBuild(balance, { cash: share, cost: share, mode: "cash" }).principal, 0);

  const topped = fundBuild(balance, { cash: 0, cost: share, mode: "big" });
  assert.equal(topped.ok, true);
  assert.equal(topped.principal, share);
  assert.equal(topped.cashAfter, 0);
  assert.equal(topped.due, topped.principal + topped.interest);
  assert.ok(topped.principal < quoteLoan(share / JV_SHARE, "big", balance).principal);

  let state = bought(8);
  const quote = contractorQuote(catalog, state, "jingjin");
  state = { ...state, cash: 1000 };
  const denied = chooseContractor(catalog, state, "jingjin", null, "cash");
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "short_cash");
  assert.equal(denied.state, state);
  assert.equal(denied.state.cash, 1000);
  assert.ok(denied.shortfall > 0);
  assert.equal(denied.loans.big.ok, true);
  assert.ok(denied.loans.big.due > denied.loans.big.principal);

  const funded = chooseContractor(catalog, state, "jingjin", null, "big");
  assert.equal(funded.ok, true);
  assert.ok(funded.state.cash >= 0);
  assert.equal(funded.state.project.contractor.cost, quote.playerCost);
  assert.equal(funded.state.project.loan.due, funded.state.project.loan.principal + funded.state.project.loan.interest);
  assert.ok(funded.state.project.loan.principal <= quote.playerCost);
  assert.ok(funded.state.project.loan.interest > 0);
});

test("skipping the build lapse does not skip the stall choice, and the quote matches", () => {
  const base = bought(8);
  let collapsed = null;
  let quote = null;
  for (let seed = 1; seed < 80 && !collapsed; seed += 1) {
    const trial = { ...base, rngCursor: seed >>> 0, cash: base.cash };
    quote = contractorQuote(catalog, trial, "jingjin");
    const picked = chooseContractor(catalog, trial, "jingjin", null, "big");
    if (picked.ok && picked.state.project.contractor.collapsed) collapsed = picked.state;
  }
  assert.ok(collapsed);
  assert.equal(lapseExit(collapsed).screen, "remedy");
  assert.equal(lapseExit(collapsed).remedyPending, true);
  assert.equal(collapsed.project.contractor.remedyPending, true);
  assert.equal(commitSale(catalog, collapsed, { price: "fair", cheer: 0, leftover: "cut" }).ok, false);
  assert.equal(collapsed.project.contractor.cost, quote.playerCost);
  assert.equal(collapsed.project.contractor.extra, remedyExtra(balance, quote.cost, 1, "rush"));
  const rush = chooseRemedy(catalog, collapsed, "rush").state;
  const worse = chooseRemedy(catalog, collapsed, "worse").state;
  assert.equal(lapseExit(rush).screen, "sale");
  assert.equal(rush.project.contractor.extra, remedyExtra(balance, quote.cost, 1, "rush"));
  assert.equal(worse.project.contractor.extra, remedyExtra(balance, quote.cost, 1, "worse"));
  assert.ok(rush.cash >= 0 && worse.cash >= 0);
  assert.equal(commitSale(catalog, rush, { price: "fair", cheer: 0, leftover: "cut" }).ok, true);
});

test("typography keeps 揀、沽清、預計沽出 and shows the cost per foot once", () => {
  const copy = playerFacingCopy().join("\n");
  const main = readFileSync(new URL("../game/main.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../game/styles.css", import.meta.url), "utf8");
  assert.ok(copy.includes("揀"));
  assert.ok(copy.includes("沽清"));
  assert.ok(t("tc", "forecastPct", { pct: 82 }).includes("預計沽出"));
  assert.equal(copy.includes("擬選"), false);
  assert.equal(copy.includes("預計估出"), false);
  assert.equal(copy.includes("估清"), false);
  assert.ok(t("tc", "costPsf", { n: "$1" }).startsWith("預計成本呎價"));
  assert.equal(t("tc", "salesBand", { low: 12, high: 28 }).includes("預計沽出"), false);
  assert.equal(unitRowNote(["280呎", "大手／收租", "高", "偏遠＋辣"]).includes("成本"), false);
  assert.equal(css.includes("42vw"), false);
  assert.equal(main.includes("max-width: 42vw"), false);
  assert.ok(main.includes("unitRowNote"));
  assert.ok(css.includes(".dock button.go"));
  assert.ok(copy.includes("遊戲內聯營，娛樂模擬，非投資意見"));
});

test("a badly mismatched mix is taught once and again after a failed sale", () => {
  let state = bought(4);
  state.project.offer = { ...state.project.offer, district: "北區", flavour: "starter", heat: "spicy" };
  const luxury = mixPreset(state.project.offer.gfaFt2, "luxury");
  const band = buildSalesBand(catalog, state, luxury, "jingjin");
  assert.ok(band.high <= 22);
  assert.equal(band.weak, true);
  assert.equal(shouldTeachMismatch(state, band), true);
  const taught = acknowledgeMismatch(state).state;
  assert.equal(shouldTeachMismatch(taught, band), false);
  const starter = mixPreset(state.project.offer.gfaFt2, "starter");
  const fit = buildSalesBand(catalog, state, starter, "huimen");
  assert.ok(fit.high > band.high);

  const built = chooseContractor(catalog, { ...state, cash: state.cash + 5_000_000_000 }, "jingjin", luxury, "cash");
  assert.equal(built.ok, true);
  assert.equal(built.state.project.mixWeak, true);
  let selling = built.state;
  if (selling.project.contractor.remedyPending) selling = chooseRemedy(catalog, selling, "worse").state;
  const failed = resolveSale(catalog, selling, { price: "expensive", cheer: 0, leftover: "cut", roll: 1 });
  selling = { ...selling, phase: "settle", project: { ...selling.project, sale: failed } };
  if (failed.outcome !== "fail") {
    selling.project.sale = { ...failed, outcome: "fail" };
  }
  assert.equal(mismatchEcho(selling.project), true);
  assert.equal(mismatchEcho({ ...selling.project, mixWeak: false }), false);
});

test("settlement shows the cash the HUD will use and any unpaid loan", () => {
  let state = bought(11);
  state = chooseContractor(catalog, state, "huimen", null, "big").state;
  if (state.project.contractor.remedyPending) state = chooseRemedy(catalog, state, "rush").state;
  state = commitSale(catalog, state, { price: "fair", cheer: 0, leftover: "cut" }).state;
  state.cash = 1000;
  state.project.sale.netCash = 0;
  const preview = settlementPreview(catalog, state);
  const next = confirmSettle(catalog, state).state;
  assert.equal(preview.cash, next.cash);
  assert.equal(preview.owed, next.credit.owed);
  assert.ok(preview.owed > 0);
  assert.equal(preview.yellow, true);
  assert.ok(preview.cash >= 0);
  assert.ok(preview.due > preview.paid);
});

test("build time shows a sales band and the sale screen keeps the exact percent", () => {
  const state = bought(6);
  const band = buildSalesBand(catalog, state, state.project.offer.mixHint, "huimen");
  assert.ok(band.low <= band.pct && band.pct <= band.high);
  assert.ok(band.high - band.low <= (balance.bandSpread ?? 8) * 2);
  const other = buildSalesBand(catalog, state, mixPreset(state.project.offer.gfaFt2, "luxury"), "xinjing");
  assert.notEqual(other.pct, band.pct);
  let selling = chooseContractor(catalog, state, "huimen").state;
  if (selling.project.contractor.remedyPending) selling = chooseRemedy(catalog, selling, "rush").state;
  const forecast = saleForecast(catalog, selling, { price: "fair", cheer: 0, leftover: "cut" });
  assert.equal(typeof forecast.pct, "number");
  assert.ok(t("tc", "forecastPct", { pct: forecast.pct }).includes("預計沽出"));
});

test("the sale screen can price construction, promotion, and the cheer uplift", () => {
  let state = bought(6);
  state = chooseContractor(catalog, state, "huimen").state;
  if (state.project.contractor.remedyPending) state = chooseRemedy(catalog, state, "rush").state;
  const before = { price: "fair", showflat: true, cheer: 0, leftover: "cut", rebate: "std", adBudget: "low", adTarget: "starter" };
  const ledger = saleLedger(catalog, state, before);
  const sale = ledger.sale;
  assert.equal(ledger.build, state.project.contractor.total);
  assert.equal(ledger.promo, sale.rebateCost + sale.adCost + sale.showflatCost);
  assert.ok(ledger.promo > 0);
  assert.equal(typeof ledger.multiple, "number");
  assert.ok(ledger.multiple > 0);
  const cheered = saleLedger(catalog, state, { ...before, cheer: 3 });
  assert.equal(cheered.profit - ledger.profit, cheered.sale.profit - sale.profit);
});

test("one bad project does not permanently lock a flagship opportunity", () => {
  const opening = start(4);
  assert.ok(opening.offers.every((offer) => offer.siteTier !== "flagship"));
  let rich = { ...opening, cash: 8_000_000_000, completed: 14, credit: { unpaidStreak: 0, carried: 0, yellow: false, forceSmall: false, owed: 0 } };
  rich = rollOffers(rich, catalog);
  const flagship = rich.offers.find((offer) => offer.siteTier === "flagship");
  assert.ok(flagship);
  assert.ok(unitTotal(mixPreset(flagship.gfaFt2, "studio")) >= 10000);
  const locked = rollOffers({ ...rich, credit: { ...rich.credit, forceSmall: true } }, catalog);
  assert.ok(locked.offers.every((offer) => offer.siteTier === "small"));

  let state = start(1);
  let guard = 0;
  let sawFlagship = false;
  let disaster = false;
  while (state.phase !== "summary" && state.phase !== "gameover" && guard < 500) {
    guard += 1;
    assert.ok(state.cash >= 0);
    if (state.phase === "story") state = chooseStory(catalog, state, state.story.choices[0].id).state;
    else if (state.phase === "land") {
      if (state.offers.some((offer) => offer.siteTier === "flagship")) sawFlagship = true;
      const offers = [...state.offers].sort((a, b) => b.gfaFt2 - a.gfaFt2);
      const badTurn = !disaster && state.completed + 1 >= 3;
      const affordable = badTurn
        ? [...state.offers].sort((a, b) => a.landTotal - b.landTotal).find((offer) => offer.landTotal <= state.cash)
        : offers.find((offer) => offer.type === "gov" && offer.landTotal <= state.cash)
          || offers.find((offer) => offer.landTotal <= state.cash);
      if (!affordable) state = skipLand(catalog, state).state;
      else {
        if (badTurn) disaster = true;
        state = chooseLand(catalog, state, affordable.slot).state;
      }
    } else if (state.phase === "build") {
      const bad = state.project.index === 3;
      let built = chooseContractor(catalog, state, bad ? "jingjin" : "huimen", bad ? { studio: 0, one: 0, two: 0, three: 0, feature: 8 } : null, bad ? "big" : "cash");
      if (!built.ok) built = chooseContractor(catalog, state, "huimen", null, "big");
      assert.equal(built.ok, true);
      assert.ok(built.state.cash >= 0);
      state = built.state;
    } else if (state.phase === "sell") {
      if (state.project.contractor.remedyPending) state = chooseRemedy(catalog, state, "worse").state;
      const bad = state.project.index === 3;
      state = commitSale(catalog, state, { price: bad ? "expensive" : "fair", cheer: bad ? 0 : 2, leftover: "cut", rebate: bad ? "none" : "std" }).state;
    } else if (state.phase === "settle") state = confirmSettle(catalog, state).state;
    else break;
  }
  assert.equal(state.phase, "summary");
  assert.equal(state.credit.forceSmall, false);
  assert.equal(sawFlagship, campaignWorth(state) >= balance.siteTiers.find((row) => row.id === "flagship").minWorth);
  assert.ok(campaignWorth(state) > 0);
});

test("a 35% venture is only on mid-tier government sites and credit stays on that share", () => {
  const small = start(4).offers[0];
  assert.equal(small.siteTier, "small");
  assert.equal(jvEligible(small), false);
  assert.equal(chooseLand(catalog, start(4), small.slot, JV_SHARE).error, "bad_stake");

  let rich = { ...start(9), cash: 20_000_000_000, completed: 14, credit: { unpaidStreak: 0, carried: 0, yellow: false, forceSmall: false, owed: 0 } };
  rich = rollOffers(rich, catalog);
  const shared = rich.offers.find((offer) => offer.type === "ura" || offer.type === "mtr");
  if (shared) assert.equal(jvEligible(shared), false);
  const venture = rich.offers.find((offer) => jvEligible(offer));
  assert.ok(venture);
  assert.notEqual(venture.siteTier, "small");
  assert.equal(venture.partnerRate, 0);
  const broke = { ...rich, cash: Math.round(venture.landTotal * JV_SHARE) };
  assert.equal(chooseLand(catalog, broke, venture.slot, 1).ok, false);
  const taken = chooseLand(catalog, broke, venture.slot, JV_SHARE);
  assert.equal(taken.ok, true);
  assert.equal(stakeOf(taken.state.project.offer), JV_SHARE);
  assert.equal(taken.state.project.offer.landPaid, Math.round(venture.landTotal * JV_SHARE));
  assert.equal(taken.state.cash, broke.cash - taken.state.project.offer.landPaid);

  const quote = contractorQuote(catalog, taken.state, "huimen");
  assert.equal(quote.playerCost, Math.round(quote.cost * JV_SHARE));
  const funded = { ...taken.state, cash: quote.playerCost };
  const plan = fundBuild(balance, { cash: funded.cash, cost: quote.playerCost, mode: "big" });
  assert.equal(plan.principal, quoteLoan(quote.playerCost, "big", balance).principal);
  assert.ok(plan.principal < quoteLoan(quote.cost, "big", balance).principal);
  const built = chooseContractor(catalog, funded, "huimen", null, "big");
  assert.equal(built.ok, true);
  assert.ok(built.state.cash >= 0);
  assert.equal(built.state.project.contractor.cost, quote.playerCost);
  assert.equal(built.state.project.loan.principal, plan.principal);
  let selling = built.state;
  if (selling.project.contractor.collapsed) {
    const gross = selling.project.contractor.grossCost;
    const rush = chooseRemedy(catalog, selling, "rush").state;
    assert.equal(rush.project.contractor.extra, remedyExtra(balance, gross, JV_SHARE, "rush"));
    selling = chooseRemedy(catalog, selling, "worse").state;
    assert.equal(selling.project.contractor.extra, remedyExtra(balance, gross, JV_SHARE, "worse"));
  }
  const joint = resolveSale(catalog, selling, { price: "fair", showflat: true, cheer: 0, leftover: "cut", rebate: "std", adBudget: "low", adTarget: "starter" });
  const wholeOffer = { ...selling.project.offer, stake: 1, landPaid: selling.project.offer.landTotal };
  const wholeContractor = {
    ...selling.project.contractor,
    total: selling.project.contractor.grossCost + Math.round((selling.project.contractor.extra || 0) / JV_SHARE),
  };
  const whole = resolveSale(catalog, { ...selling, project: { ...selling.project, offer: wholeOffer, contractor: wholeContractor } }, {
    price: "fair", showflat: true, cheer: 0, leftover: "cut", rebate: "std", adBudget: "low", adTarget: "starter",
  });
  assert.ok(joint.showflatCost > 0);
  assert.ok(Math.abs(joint.showflatCost / whole.showflatCost - JV_SHARE) < 0.02);
  assert.ok(Math.abs(joint.rebateCost / whole.rebateCost - JV_SHARE) < 0.05 || whole.rebateCost === 0);
  assert.ok(joint.netCash < whole.netCash);
  assert.ok(joint.netCash > 0);
});

test("venture stakes are only 25, 35, 50, or fully owned", () => {
  assert.deepEqual(JV_SHARES, [0.25, 0.35, 0.5]);
  assert.equal(stakeOf({ stake: 0.25 }), 0.25);
  assert.equal(stakeOf({ stake: 0.35 }), 0.35);
  assert.equal(stakeOf({ stake: 0.5 }), 0.5);
  assert.equal(stakeOf({ stake: 1 }), 1);
  assert.equal(stakeOf({}), 1);
  assert.equal(stakeOf({ stake: 0.2 }), 1);
  assert.equal(stakeOf({ stake: 0.4 }), 1);

  let rich = { ...start(9), cash: 20_000_000_000, completed: 14, credit: { unpaidStreak: 0, carried: 0, yellow: false, forceSmall: false, owed: 0 } };
  rich = rollOffers(rich, catalog);
  const venture = rich.offers.find((offer) => jvEligible(offer));
  assert.ok(venture);
  for (const share of JV_SHARES) {
    const broke = { ...rich, cash: Math.round(venture.landTotal * share) };
    const taken = chooseLand(catalog, broke, venture.slot, share);
    assert.equal(taken.ok, true, share);
    assert.equal(stakeOf(taken.state.project.offer), share);
    assert.equal(taken.state.project.offer.landPaid, Math.round(venture.landTotal * share));
    const quote = contractorQuote(catalog, taken.state, "huimen");
    assert.equal(quote.playerCost, Math.round(quote.cost * share));
    const whole = resolveSale(catalog, {
      ...taken.state,
      project: {
        ...taken.state.project,
        offer: { ...taken.state.project.offer, stake: 1, landPaid: venture.landTotal },
        contractor: { id: "huimen", quality: 1, leak: 0, collapsed: false, total: quote.cost, cost: quote.cost, saleDrag: 0 },
        mix: venture.mixHint,
      },
    }, { price: "fair", showflat: true, cheer: 0, leftover: "cut", rebate: "none", adBudget: "none" });
    const part = resolveSale(catalog, {
      ...taken.state,
      project: {
        ...taken.state.project,
        contractor: { id: "huimen", quality: 1, leak: 0, collapsed: false, total: quote.playerCost, cost: quote.playerCost, saleDrag: 0 },
        mix: venture.mixHint,
      },
    }, { price: "fair", showflat: true, cheer: 0, leftover: "cut", rebate: "none", adBudget: "none" });
    assert.ok(Math.abs(part.showflatCost / whole.showflatCost - share) < 0.02);
    assert.ok(part.netCash < whole.netCash);
    const shared = rich.offers.find((offer) => offer.type === "ura" || offer.type === "mtr");
    if (shared) assert.equal(chooseLand(catalog, { ...rich, cash: shared.landTotal }, shared.slot, share).error, "bad_stake");
  }
  assert.equal(remedyExtra(balance, 100000, 0.25, "rush"), Math.round(100000 * balance.collapseExtra * 0.25));
  assert.equal(remedyExtra(balance, 100000, 0.5, "worse"), Math.round(100000 * balance.remedy.worseExtra * 0.5));
});

test("opening projects stay small, so 25% cannot buy a flagship", () => {
  const opening = start(4);
  assert.ok(opening.offers.every((offer) => offer.siteTier === "small"));
  assert.ok(opening.offers.every((offer) => jvEligible(offer) === false));
  assert.equal(chooseLand(catalog, opening, opening.offers[2].slot, 0.25).error, "bad_stake");
  assert.equal(balance.flagshipFrom, 12);
  assert.equal(balance.siteTiers.find((row) => row.id === "flagship").minWorth, 3600000000);
  assert.equal(rollSiteTier(9_000_000_000_000, opening.seed, 0, balance, false), "small");
  assert.equal(rollSiteTier(9_000_000_000_000, opening.seed, 1, balance, false), "small");
  let scaled = { ...start(3), cash: 2_000_000_000, completed: 14, credit: { unpaidStreak: 0, carried: 0, yellow: false, forceSmall: false, owed: 0 } };
  scaled = rollOffers(scaled, catalog);
  assert.ok(scaled.offers.every((offer) => offer.siteTier !== "flagship"));
});

test("a 25% mid site does not cancel the small government survival plot", () => {
  const levels = initialMarket();
  const mid = priceOffer({ slot: "A", type: "gov", district: "元朗區", gfaFt2: 80000, premium: 1.1 }, levels, catalog, "loose");
  mid.siteTier = "mid";
  const offers = [
    { ...mid, slot: "A" },
    { ...mid, slot: "B", landTotal: mid.landTotal + 1000 },
    { ...mid, slot: "C", type: "ura", partnerRate: 0.22, siteTier: "flagship" },
  ];
  const cash = Math.round(mid.landTotal * 0.3);
  assert.ok(cash >= mid.landTotal * 0.25);
  assert.ok(cash < mid.landTotal * 0.35);
  const state = { cash, market: levels, credit: { forceSmall: false } };
  const next = ensureAffordableOffer(offers, state, catalog, "loose");
  const injected = next.find((offer) => offer.siteTier === "small" && offer.type === "gov");
  assert.ok(injected);
  assert.ok(next.every((offer) => offer.slot !== "C" || offer.siteTier === "flagship"));
  assert.equal(injected.siteTier, "small");
  const covered = ensureAffordableOffer(offers, { ...state, cash: Math.round(mid.landTotal * 0.35) }, catalog, "loose");
  assert.equal(covered.find((offer) => offer.siteTier === "small" && offer.slot === "B"), undefined);
});

test("save version 7 keeps an in-progress 0.35 stake and fills chair and avatar", () => {
  let state = start(6);
  state = chooseLand(catalog, state, "A").state;
  const raw = serializeCampaign(state);
  raw.v = 6;
  raw.project.offer.stake = 0.35;
  const history = [{ index: 1, name: "舊盤", stake: 0.2, note: "keep" }];
  raw.history = history;
  delete raw.company.chairName;
  delete raw.company.avatar;
  const migrated = migrateSave(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.v, 7);
  assert.equal(migrated.state.project.offer.stake, 0.35);
  assert.equal(migrated.state.company.chairName, "主席");
  assert.equal(migrated.state.company.avatar, "crop");
  assert.equal(migrated.state.history[0].note, "keep");
  assert.equal(migrated.state.history[0].stake, 0.2);
  const hydrated = hydrateCampaign(catalog, migrated.state);
  assert.equal(stakeOf(hydrated.project.offer), 0.35);
  assert.equal(hydrated.company.chairName, "主席");
  assert.equal(hydrated.cash, state.cash);

  const missing = serializeCampaign(state);
  missing.v = 6;
  delete missing.project.offer.stake;
  delete missing.company.chairName;
  assert.equal(migrateSave(missing).state.project.offer.stake, 1);
  const odd = serializeCampaign(state);
  odd.v = 6;
  odd.project.offer.stake = 0.2;
  assert.equal(migrateSave(odd).state.project.offer.stake, 1);

  for (const version of [3, 4, 5]) {
    const legacy = serializeCampaign(start(8));
    legacy.v = version;
    if (version < 5) delete legacy.credit;
    if (version < 4) delete legacy.voice;
    const upgraded = migrateSave(legacy);
    assert.equal(upgraded.ok, true);
    assert.equal(upgraded.notice, null);
    assert.equal(upgraded.state.v, 7);
    assert.equal(upgraded.state.company.chairName, "主席");
    assert.ok(upgraded.state.company.avatar);
    assert.equal(hydrateCampaign(catalog, upgraded.state).cash, legacy.cash);
  }
});

test("metro sell boost is in the build band and the showroom forecast", () => {
  assert.ok(balance.landTypes.mtr.sellBoost >= 0.08 && balance.landTypes.mtr.sellBoost <= 0.12);
  const mix = { studio: 20, one: 0, two: 0, three: 0, feature: 0 };
  const base = priceOffer({ slot: "A", type: "gov", district: "沙田區", gfaFt2: 22000, premium: 1 }, initialMarket(), catalog, "spicy");
  const stateFor = (type) => ({
    seed: 1,
    completed: 0,
    cash: 1_000_000_000,
    reputation: 58,
    market: initialMarket(),
    poolBias: {},
    phase: "build",
    project: {
      offer: { ...base, type, partnerRate: balance.landTypes[type].partnerRate, heat: "spicy" },
      mix,
      contractor: { id: "huimen", quality: 1, leak: 0, collapsed: false, total: 0, cost: 0, saleDrag: 0 },
    },
  });
  const gov = stateFor("gov");
  const mtr = stateFor("mtr");
  const govBand = buildSalesBand(catalog, gov, mix, "huimen");
  const mtrBand = buildSalesBand(catalog, mtr, mix, "huimen");
  const govSale = resolveSale(catalog, gov, { price: "fair", cheer: 0, leftover: "cut", rebate: "none", adBudget: "none", roll: 1 });
  const mtrSale = resolveSale(catalog, mtr, { price: "fair", cheer: 0, leftover: "cut", rebate: "none", adBudget: "none", roll: 1 });
  assert.ok(mtrSale.byType.studio.convert > govSale.byType.studio.convert);
  assert.ok(Math.abs((mtrSale.byType.studio.convert - govSale.byType.studio.convert) - balance.landTypes.mtr.sellBoost) < 0.02);
  assert.ok(mtrBand.pct > govBand.pct);
  const selling = {
    ...mtr,
    phase: "sell",
    project: {
      ...mtr.project,
      contractor: { id: "huimen", quality: 1, leak: 0, collapsed: false, total: base.estBuildTotal, cost: base.estBuildTotal, saleDrag: 0 },
    },
  };
  const plain = {
    ...selling,
    project: { ...selling.project, offer: { ...selling.project.offer, type: "gov", partnerRate: 0 } },
  };
  const forecast = saleForecast(catalog, selling, { price: "fair", cheer: 0, leftover: "cut" });
  const without = saleForecast(catalog, plain, { price: "fair", cheer: 0, leftover: "cut" });
  assert.ok(forecast.pct > without.pct);
  assert.ok(t("tc", "forecastPct", { pct: forecast.pct }).includes("預計沽出"));
  assert.equal(t("tc", "salesBand", { low: mtrBand.low, high: mtrBand.high }).includes("預計沽出"), false);
});

test("reset mix restores the project preset and a weak band warns on a large loan", () => {
  const state = bought(6);
  const preset = projectPresetMix(catalog, state);
  assert.deepEqual(preset, presetMix(state.project.offer.gfaFt2, state.project.offer.flavour, state.project.offer.heat, balance));
  assert.deepEqual(preset, state.project.offer.mixHint);
  const luxury = mixPreset(state.project.offer.gfaFt2, "luxury");
  assert.notDeepEqual(luxury, preset);
  const weak = buildSalesBand(catalog, state, luxury, "jingjin");
  assert.ok(weak.pct < 80);
  assert.equal(bigLoanWarned(weak.pct, "big"), true);
  assert.equal(bigLoanWarned(weak.pct, "small"), false);
  assert.equal(bigLoanWarned(80, "big"), false);
  assert.equal(bigLoanWarned(79, "big"), true);
  assert.equal(bigLoanWarned(49, "big"), true);
  const outlook = buildOutlook(catalog, state, luxury, "jingjin", "big");
  assert.equal(outlook.warnBig, true);
  assert.ok(outlook.interest > 0);
  assert.equal(t("tc", "loanWarn"), "銷情未夠綠，借大數利息可能食晒利潤。娛樂模擬，非借貸意見。");
  assert.equal(t("tc", "loanWarn").includes("食咗"), false);
  assert.equal(t("tc", "loanCompare", { interest: "$1", profit: "$2" }), "息 $1 · 預計你份利潤約 $2");
  assert.equal(t("tc", "loanDisclaimer"), "遊戲內借貸，娛樂模擬，非借貸意見");
});

test("a sell-out celebration only runs when the project fully clears", () => {
  assert.equal(celebrateClear("clear"), true);
  assert.equal(celebrateClear("almost"), false);
  assert.equal(celebrateClear("partial"), false);
  assert.equal(celebrateClear("fail"), false);
  const main = readFileSync(new URL("../game/main.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../game/styles.css", import.meta.url), "utf8");
  assert.ok(main.includes("celebrateClear"));
  assert.ok(css.includes(".clear-stamp"));
  assert.ok(css.includes("confetti"));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.equal(css.includes(".jv-line { display: none"), false);
  assert.equal(css.includes(".project-name { display: none"), false);
  assert.ok(css.includes(".title-line"));
  assert.ok(css.includes(".reset-mix"));
  assert.ok(css.includes(".sales-band"));
  const copy = playerFacingCopy().join("\n");
  assert.equal(copy.includes("沸清"), false);
  assert.equal(copy.includes("預計沸出"), false);
  assert.equal(copy.includes("深水埐"), false);
  assert.equal(copy.includes("娓樂"), false);
  assert.ok(copy.includes("沽清"));
  assert.ok(copy.includes("預計沽出"));
  assert.ok(copy.includes("娛樂模擬"));
  assert.equal(t("tc", "typeGovNote"), "無分成");
  assert.equal(t("tc", "govSettle"), "政府地無分成。");
  assert.equal(t("tc", "jvLine", { you: 50, partner: 50 }), "你出 50% · 夥伴 50% · 之後按呢個份額分");
  assert.ok(t("tc", "mtrRail").includes("鐵路交通"));
  for (let i = 0; i < 30; i += 1) {
    const district = pickDistrict("gov", { next: () => i / 30 }, balance);
    assert.ok(balance.urbanDistricts.includes(district) || balance.newTownDistricts.includes(district));
  }
});
