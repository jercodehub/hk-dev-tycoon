import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  JV_SHARE,
  buildSalesBand,
  campaignWorth,
  chooseContractor,
  chooseLand,
  chooseRemedy,
  chooseStory,
  commitSale,
  confirmSettle,
  contractorQuote,
  createCampaign,
  createCampaignCatalog,
  fundBuild,
  jvEligible,
  lapseExit,
  mismatchEcho,
  mixPreset,
  quoteLoan,
  remedyExtra,
  resolveSale,
  rollOffers,
  saleForecast,
  saleLedger,
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
  assert.equal(sawFlagship, true);
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
