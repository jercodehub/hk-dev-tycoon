// Land tender engine: sealed-bid government land and fixed-price rail sites.
// Pure functions only. The UI layer decides when to call these, so the whole
// system can stay switched off behind a flag while the rest of the game runs
// exactly as before.

export const TENDER = {
  depositRate: 0.1,
  depositCapShare: 0.4,
  rivalsMin: 2,
  rivalsMax: 4,
  rivalCapMin: 1,
  rivalCapMax: 1.35,
  reserveMin: 0.92,
  reserveMax: 1.02,
  trendLookback: 3,
  trendLift: 0.05,
  trendCut: 0.06,
  intelBase: 0.12,
  intelTight: 0.08,
  requeueRounds: 2,
};

const roundMoney = (value) => Math.round(Number(value) || 0);
const roundPsf = (value) => Math.max(0, Math.round(Number(value) || 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

function trendFactor(trend) {
  const t = clamp(Number(trend) || 0, -1, 1);
  if (t > 0) return 1 + TENDER.trendLift * t;
  if (t < 0) return 1 + TENDER.trendCut * t;
  return 1;
}

// rival count follows market heat: a speculative market draws more bidders
function rivalCount(rng, heat) {
  const spicy = heat === "spicy";
  const min = spicy ? TENDER.rivalsMin + 1 : TENDER.rivalsMin;
  const max = spicy ? TENDER.rivalsMax : TENDER.rivalsMax - 1;
  return min + Math.floor(rng.next() * (max - min + 1));
}

/**
 * Build the hidden tender book for one site.
 * basePsf is the district land price the rest of the game already uses.
 */
export function createTender({ basePsf, gfaFt2, kind = "gov", heat = "loose", trend = 0, rng } = {}) {
  const base = Math.max(1, roundPsf(basePsf));
  const gfa = Math.max(1, roundMoney(gfaFt2));
  const reservePsf = roundPsf(base * lerp(TENDER.reserveMin, TENDER.reserveMax, rng.next()));
  const count = rivalCount(rng, heat);
  const factor = trendFactor(trend);
  const rivals = Array.from({ length: count }, () => {
    const cap = reservePsf * lerp(TENDER.rivalCapMin, TENDER.rivalCapMax, rng.next()) * factor;
    return { capPsf: roundPsf(cap) };
  });
  return {
    kind,
    basePsf: base,
    gfaFt2: gfa,
    reservePsf,
    reserveTotal: roundMoney(reservePsf * gfa),
    depositRate: TENDER.depositRate,
    rivals,
    intelPct: TENDER.intelBase,
    requeueIn: null,
  };
}

export function depositFor(bidPsf, gfaFt2, rate = TENDER.depositRate) {
  return roundMoney(roundPsf(bidPsf) * Math.max(1, roundMoney(gfaFt2)) * rate);
}

/** Highest per-foot bid a player can lodge before the deposit cap bites. */
export function maxBidPsf({ cash, gfaFt2, rate = TENDER.depositRate, capShare = TENDER.depositCapShare } = {}) {
  const budget = Math.max(0, Number(cash) || 0) * capShare;
  const gfa = Math.max(1, roundMoney(gfaFt2));
  return Math.floor(budget / (gfa * rate));
}

/**
 * Resolve a sealed bid.
 * outcome: win | lose | void | blocked
 * - void means nobody reached the reserve price
 * - blocked means the bid could not be lodged at all
 */
export function resolveTender({ tender, bidPsf, cash, gfaFt2 } = {}) {
  const gfa = Math.max(1, roundMoney(gfaFt2 ?? tender?.gfaFt2));
  const rate = Number(tender?.depositRate) || TENDER.depositRate;
  const bid = roundPsf(bidPsf);
  const deposit = depositFor(bid, gfa, rate);
  if (bid <= 0) {
    return { outcome: "blocked", reason: "no_bid", yourBidPsf: 0, deposit: 0, refund: 0 };
  }
  const cap = Math.max(0, Number(cash) || 0) * TENDER.depositCapShare;
  if (deposit > cap) {
    return {
      outcome: "blocked",
      reason: "deposit_cap",
      yourBidPsf: bid,
      requiredDeposit: deposit,
      deposit: 0,
      refund: 0,
    };
  }
  const rivals = Array.isArray(tender?.rivals) ? tender.rivals : [];
  const topRival = rivals.reduce((top, rival) => Math.max(top, Number(rival?.capPsf) || 0), 0);
  const reserve = Number(tender?.reservePsf) || 0;
  const clearing = Math.max(bid, topRival);
  if (clearing < reserve) {
    return {
      outcome: "void",
      reason: "below_reserve",
      yourBidPsf: bid,
      deposit,
      refund: deposit,
      reservePsf: reserve,
      topRivalPsf: topRival,
    };
  }
  if (bid >= topRival && bid >= reserve) {
    return {
      outcome: "win",
      reason: "highest",
      yourBidPsf: bid,
      clearingPsf: bid,
      secondPsf: topRival,
      premiumPct: topRival > 0 ? (bid - topRival) / topRival : 0,
      deposit,
      refund: 0,
      reservePsf: reserve,
    };
  }
  const shortfallPct = clearing > 0 ? (clearing - bid) / clearing : 0;
  return {
    outcome: "lose",
    reason: "outbid",
    yourBidPsf: bid,
    clearingPsf: clearing,
    topRivalPsf: topRival,
    shortfallPct,
    deposit,
    refund: deposit,
    reservePsf: reserve,
  };
}

/** Losing a tender buys information: the district range narrows. */
export function narrowIntel(previous, outcome) {
  const base = Number(previous?.pct) || TENDER.intelBase;
  if (outcome === "lose") {
    return { pct: Math.min(base, TENDER.intelTight), narrowed: base > TENDER.intelTight };
  }
  return { pct: base, narrowed: false };
}

export function requeueRound(completed, rounds = TENDER.requeueRounds) {
  return Math.max(0, Math.round(Number(completed) || 0)) + rounds;
}
