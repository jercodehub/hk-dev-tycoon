import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  availableCash,
  createCampaign,
  createCampaignCatalog,
  createRng,
  forfeitTenderDeposit,
  hydrateCampaign,
  landTenderEnabled,
  lockedDeposits,
  maxTenderBid,
  releaseTenderDeposit,
  serializeCampaign,
  submitTender,
  tenderBook,
} from "../game/campaign.js";
import {
  TENDER,
  createTender,
  depositFor,
  maxBidPsf,
  narrowIntel,
  requeueRound,
  resolveTender,
} from "../game/tender.js";

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}
const balance = load("../game/campaign-balance.json");
const market = load("../data/market-stats.json");
const catalog = createCampaignCatalog({ market, balance });

function book(seed = 7, overrides = {}) {
  return createTender({
    basePsf: 5000,
    gfaFt2: 100000,
    heat: "loose",
    trend: 0,
    rng: createRng(seed),
    ...overrides,
  });
}

test("reserve price stays inside the published band", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const tender = book(seed);
    assert.ok(tender.reservePsf >= Math.floor(5000 * TENDER.reserveMin));
    assert.ok(tender.reservePsf <= Math.ceil(5000 * TENDER.reserveMax));
  }
});

test("rival count follows market heat", () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    assert.ok(book(seed).rivals.length >= TENDER.rivalsMin);
    assert.ok(book(seed).rivals.length <= TENDER.rivalsMax - 1);
    assert.ok(book(seed, { heat: "spicy" }).rivals.length >= TENDER.rivalsMin + 1);
    assert.ok(book(seed, { heat: "spicy" }).rivals.length <= TENDER.rivalsMax);
  }
});

test("a bid above every rival wins and keeps the deposit", () => {
  const tender = book(11);
  const top = Math.max(...tender.rivals.map((rival) => rival.capPsf));
  const result = resolveTender({ tender, bidPsf: top + 50, cash: 1e10, gfaFt2: tender.gfaFt2 });
  assert.equal(result.outcome, "win");
  assert.equal(result.refund, 0);
  assert.equal(result.deposit, depositFor(top + 50, tender.gfaFt2));
  assert.ok(result.secondPsf <= top);
});

test("a bid under the winning rival loses with a shortfall", () => {
  const tender = book(13);
  const top = Math.max(...tender.rivals.map((rival) => rival.capPsf));
  const bid = Math.max(1, Math.round(tender.reservePsf));
  const result = resolveTender({ tender, bidPsf: bid, cash: 1e10, gfaFt2: tender.gfaFt2 });
  assert.equal(result.outcome, "lose");
  assert.equal(result.refund, result.deposit);
  assert.ok(result.shortfallPct > 0);
  assert.equal(result.clearingPsf, Math.max(bid, top));
});

test("nobody reaching the reserve voids the tender", () => {
  const tender = { ...book(17), reservePsf: 9000, rivals: [{ capPsf: 8000 }, { capPsf: 8500 }] };
  const result = resolveTender({ tender, bidPsf: 8200, cash: 1e10, gfaFt2: tender.gfaFt2 });
  assert.equal(result.outcome, "void");
  assert.equal(result.refund, result.deposit);
});

test("the deposit cap blocks an oversized bid", () => {
  const tender = book(19);
  const result = resolveTender({ tender, bidPsf: 9000, cash: 1000000, gfaFt2: tender.gfaFt2 });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reason, "deposit_cap");
  assert.equal(result.deposit, 0);
});

test("maxBidPsf never exceeds the deposit cap", () => {
  const cash = 50000000;
  const gfa = 100000;
  const psf = maxBidPsf({ cash, gfaFt2: gfa });
  const deposit = depositFor(psf, gfa);
  assert.ok(deposit <= cash * TENDER.depositCapShare);
  assert.ok(depositFor(psf + 1, gfa) > cash * TENDER.depositCapShare);
});

test("losing narrows district intel and winning leaves it alone", () => {
  assert.deepEqual(narrowIntel({ pct: 0.12 }, "lose"), { pct: 0.08, narrowed: true });
  assert.deepEqual(narrowIntel({ pct: 0.08 }, "lose"), { pct: 0.08, narrowed: false });
  assert.deepEqual(narrowIntel({ pct: 0.12 }, "win"), { pct: 0.12, narrowed: false });
});

test("voided sites come back two rounds later", () => {
  assert.equal(requeueRound(5), 7);
  assert.equal(requeueRound(0), 2);
});

test("the tender book is stable for the same site and round", () => {
  const state = createCampaign(catalog, { seed: 4242, company: { name: "測試" } });
  const offer = state.offers[0];
  const first = tenderBook(state, offer);
  const second = tenderBook(state, offer);
  assert.deepEqual(first, second);
  const later = tenderBook({ ...state, completed: state.completed + 1 }, offer);
  assert.notDeepEqual(first.rivals, later.rivals);
});

test("the tender stays switched off by default", () => {
  const state = createCampaign(catalog, { seed: 99, company: { name: "測試" } });
  assert.equal(landTenderEnabled(state), false);
  const attempt = submitTender(state, state.offers[0], 6000);
  assert.equal(attempt.ok, false);
  assert.equal(attempt.error, "tender_disabled");
});

test("a winning bid locks the deposit without spending cash", () => {
  const base = createCampaign(catalog, { seed: 123, company: { name: "測試" } });
  const state = { ...base, flags: { ...base.flags, landTender: true } };
  const offer = state.offers[0];
  const tender = tenderBook(state, offer);
  const top = Math.max(...tender.rivals.map((rival) => rival.capPsf));
  const bid = top + 100;
  const attempt = submitTender(state, offer, bid);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.outcome, "win");
  assert.equal(attempt.state.cash, state.cash);
  assert.equal(lockedDeposits(attempt.state), attempt.result.deposit);
  assert.equal(availableCash(attempt.state), state.cash - attempt.result.deposit);
  assert.ok(maxTenderBid(attempt.state, offer) < maxTenderBid(state, offer));
});

test("a losing bid leaves no deposit behind", () => {
  const base = createCampaign(catalog, { seed: 321, company: { name: "測試" } });
  const state = { ...base, flags: { ...base.flags, landTender: true } };
  const offer = state.offers[0];
  const attempt = submitTender(state, offer, 1);
  assert.equal(attempt.ok, true);
  assert.notEqual(attempt.result.outcome, "win");
  assert.equal(lockedDeposits(attempt.state), 0);
});

test("releasing a deposit frees the cash, forfeiting charges it", () => {
  const base = createCampaign(catalog, { seed: 55, company: { name: "測試" } });
  const state = {
    ...base,
    flags: { ...base.flags, landTender: true },
    deposits: [{ slot: "A", district: "沙田", type: "gov", amount: 10000000, round: 3, status: "won" }],
  };
  assert.equal(availableCash(state), state.cash - 10000000);
  const released = releaseTenderDeposit(state, "A");
  assert.equal(lockedDeposits(released), 0);
  assert.equal(released.cash, state.cash);
  const forfeited = forfeitTenderDeposit(state, "A");
  assert.equal(forfeited.cash, state.cash - 10000000);
  assert.equal(lockedDeposits(forfeited), 0);
});

test("deposits survive a save round trip and old saves default to none", () => {
  const base = createCampaign(catalog, { seed: 77, company: { name: "測試" } });
  const state = {
    ...base,
    deposits: [{ slot: "B", district: "灣仔", type: "mtr", amount: 4200000, round: 2, status: "won" }],
  };
  const saved = serializeCampaign(state);
  assert.deepEqual(saved.deposits, state.deposits);
  const reloaded = hydrateCampaign(catalog, saved);
  assert.deepEqual(reloaded.deposits, state.deposits);
  const legacy = { ...saved };
  delete legacy.deposits;
  const migrated = hydrateCampaign(catalog, legacy);
  assert.deepEqual(migrated.deposits, []);
});
