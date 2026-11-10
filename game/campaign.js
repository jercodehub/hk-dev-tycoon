/**
 * Phase 3 campaign. No DOM.
 * One project = land → build → sell → settle → story. A run is 20 projects.
 * Unit mix, buyer pools, and spicy/loose heat live here.
 * Region prices still scale the model. The screen does not print them.
 */

import { DISTRICTS } from "./i18n.js";
import { STORIES } from "./stories.js";

export const SAVE_VERSION = 4;
export const UNIT_SPECS = [
  { id: "studio", ft2: 280, pool: "whale" },
  { id: "one", ft2: 350, pool: "couple" },
  { id: "two", ft2: 450, pool: "starter" },
  { id: "three", ft2: 600, pool: "upgrader" },
  { id: "feature", ft2: 1000, pool: "feature" },
];
export const POOLS = ["whale", "couple", "starter", "upgrader", "feature"];
export const FT2_PER_M2 = 10.76391041671;

const REGIONS = ["港島", "九龍", "新界"];
const PHASES = ["land", "build", "sell", "settle", "story", "summary"];
export const COMPANY_LOGOS = ["tower", "wave", "diamond", "gate", "sun", "monogram"];
export const COMPANY_COLORS = ["#e2b15a", "#6ea2ff", "#e06b6b", "#3ecf8e", "#c084fc", "#f4f1ea"];

export function money(value) {
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function fail(state, error) {
  return { ok: false, error, state };
}

function succeed(state) {
  return { ok: true, error: null, state };
}

export function createRng(seed) {
  let cursor = seed >>> 0;
  return {
    get cursor() {
      return cursor;
    },
    next() {
      cursor = (cursor + 0x6d2b79f5) >>> 0;
      let t = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function runRng(state, fn) {
  const rng = createRng(state.rngCursor);
  const value = fn(rng);
  return { value, rngCursor: rng.cursor };
}

export function regionOf(district) {
  const row = DISTRICTS.find((item) => item[0] === district);
  if (!row) throw new Error(`unknown district ${district}`);
  return row[2];
}

export function normalizeCompany(input = {}) {
  const name = String(input.name || "啟岸發展").trim().slice(0, 16) || "啟岸發展";
  const logo = COMPANY_LOGOS.includes(input.logo) ? input.logo : "tower";
  const color = COMPANY_COLORS.includes(String(input.color || "").toLowerCase())
    ? String(input.color).toLowerCase()
    : COMPANY_COLORS[0];
  return { name, logo, color };
}

export function createCampaignCatalog({ market, balance }) {
  const priceAreas = Object.keys(market?.prices?.averagePrices?.areas ?? {});
  const extra = priceAreas.filter((key) => !REGIONS.includes(key));
  if (extra.length > 0) throw new Error(`refusing district official prices: ${extra.join(",")}`);
  for (const region of REGIONS) {
    const cell = market.prices.averagePrices.areas[region]?.[balance.calibrationClass];
    if (!cell || typeof cell.value !== "number") {
      throw new Error(`missing open-data ${region} class ${balance.calibrationClass} price`);
    }
  }
  const levers = Object.keys(balance.districtLever);
  if (levers.length !== DISTRICTS.length) throw new Error("district levers must cover 18 districts");
  for (const [district] of DISTRICTS) {
    if (typeof balance.districtLever[district] !== "number") {
      throw new Error(`missing game lever for ${district}`);
    }
    if (!market.areas[district] || typeof market.areas[district].vacancyPct !== "number") {
      throw new Error(`missing open-data counts for ${district}`);
    }
  }
  if (!Array.isArray(balance.drifts) || balance.drifts.length < 4) {
    throw new Error("market drifts missing");
  }
  if (balance.projects !== 20) throw new Error("campaign is exactly 20 projects");
  if (balance.landTypes.gov.partnerRate !== 0) throw new Error("government land takes no partner share");
  for (const district of Object.keys(balance.districtLever)) {
    if (!["uni", "starter", "core"].includes(balance.flavours?.[district])) {
      throw new Error(`missing flavour for ${district}`);
    }
  }
  for (const heat of ["loose", "spicy"]) {
    for (const pool of POOLS) {
      if (typeof balance.heatMod?.[heat]?.[pool] !== "number") throw new Error(`missing ${heat} ${pool}`);
    }
  }
  for (const flavour of ["uni", "starter", "core"]) {
    for (const pool of POOLS) {
      if (typeof balance.flavourMod?.[flavour]?.[pool] !== "number") throw new Error(`missing ${flavour} ${pool}`);
    }
  }
  return { market, balance };
}

export function initialMarket() {
  return { price: 1, land: 1, build: 1, buyer: 1, step: 0, lastMove: 0 };
}

export function tickMarket(market, move, balance) {
  const price = clamp(round4(market.price * (1 + move)), balance.indexMin, balance.indexMax);
  const land = clamp(round4(market.land * (1 + move * balance.landElasticity)), balance.indexMin, balance.indexMax);
  const build = clamp(round4(market.build * (1 + move * balance.buildElasticity)), balance.indexMin, balance.indexMax);
  const buyer = clamp(round4(market.buyer * (1 + move * balance.buyerElasticity)), balance.indexMin, balance.indexMax);
  return { price, land, build, buyer, step: market.step + 1, lastMove: round4(move) };
}

export function openDataQuote(market, region, balance) {
  const klass = balance.calibrationClass;
  const cell = market.prices.averagePrices.areas[region]?.[klass];
  if (!cell || typeof cell.value !== "number") throw new Error(`no open-data region price for ${region}`);
  return {
    region,
    classId: klass,
    hkdPerM2: cell.value,
    provisional: Boolean(cell.provisional),
    month: market.prices.averagePrices.month,
    unit: market.prices.averagePrices.unit,
    territoryIndex: market.prices.priceIndex.series.all.value,
    indexMonth: market.prices.priceIndex.month,
    indexBase: market.prices.priceIndex.base,
  };
}

export function gameBench(catalog, district, levels) {
  const region = regionOf(district);
  const open = openDataQuote(catalog.market, region, catalog.balance);
  const counts = catalog.market.areas[district];
  const lever = catalog.balance.districtLever[district];
  const supply = clamp(
    1 - catalog.balance.vacancyDrag * (counts.vacancyPct / 100),
    catalog.balance.supplyMin,
    catalog.balance.supplyMax,
  );
  const anchorPerFt2 = (open.hkdPerM2 / FT2_PER_M2) * lever * supply;
  return {
    open,
    openData: open,
    region,
    district,
    lever,
    supply,
    vacancyPct: counts.vacancyPct,
    stock: counts.stock,
    completions: counts.completions,
    anchorPerFt2,
    fairLandPerFt2: anchorPerFt2 * catalog.balance.landResidual * levels.land,
    fairBuildPerFt2: anchorPerFt2 * catalog.balance.buildResidual * levels.build,
    fairSalePerFt2: anchorPerFt2 * levels.buyer,
  };
}

export function unitsFromGfa(gfaFt2, balance) {
  return clamp(Math.round(gfaFt2 / balance.areaPerUnitFt2), balance.minUnits, balance.maxUnits);
}

export function emptyMix() {
  return { studio: 0, one: 0, two: 0, three: 0, feature: 0 };
}

export function emptyBias() {
  return { whale: 0, couple: 0, starter: 0, upgrader: 0, feature: 0 };
}

export function normalizeMix(raw) {
  const mix = emptyMix();
  if (!raw) return mix;
  for (const spec of UNIT_SPECS) {
    const count = Math.floor(Number(raw[spec.id]));
    mix[spec.id] = Number.isFinite(count) && count > 0 ? count : 0;
  }
  return mix;
}

export function gfaUsed(mix) {
  const clean = normalizeMix(mix);
  return UNIT_SPECS.reduce((sum, spec) => sum + clean[spec.id] * spec.ft2, 0);
}

export function gfaRemaining(gfaFt2, mix) {
  return gfaFt2 - gfaUsed(mix);
}

export function mixFits(gfaFt2, mix) {
  return gfaRemaining(gfaFt2, mix) >= 0;
}

export function unitTotal(mix) {
  const clean = normalizeMix(mix);
  return UNIT_SPECS.reduce((sum, spec) => sum + clean[spec.id], 0);
}

export function districtFlavour(district, balance) {
  const flavour = balance.flavours?.[district];
  if (!flavour) throw new Error(`missing flavour ${district}`);
  return flavour;
}

export function campaignHeat(state, balance) {
  const every = balance.heatEvery || 3;
  const block = Math.floor((state?.completed || 0) / every);
  const looseStart = ((state?.seed || 0) % 2) === 0;
  const loose = block % 2 === 0 ? looseStart : !looseStart;
  return loose ? "loose" : "spicy";
}

export function heatProjectsLeft(state, balance) {
  const every = Math.max(1, balance?.heatEvery || 3);
  const into = (state?.completed || 0) % every;
  return every - into;
}

const FLAVOUR_TAG = { uni: "近大學", starter: "偏遠上車", core: "核心" };

export function defaultProjectName(district, flavour) {
  const short = String(district || "").replace(/區$/, "") || "項目";
  const tag = FLAVOUR_TAG[flavour] || "";
  return `${short}${tag ? `·${tag}` : ""}`.slice(0, 12);
}

export function normalizeProjectName(name, fallback) {
  const clean = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 12);
  return clean || fallback || "項目";
}

export function renameProject(catalog, state, name) {
  if (state.phase !== "build" && state.phase !== "sell") return fail(state, "bad_phase");
  if (!state.project || state.project.skipped || !state.project.offer) return fail(state, "bad_phase");
  const fallback = defaultProjectName(state.project.offer.district, state.project.offer.flavour);
  return succeed({
    ...state,
    project: { ...state.project, name: normalizeProjectName(name, fallback) },
  });
}

export function presetMix(gfaFt2, flavour, heat, balance) {
  const weights = {};
  let sum = 0;
  for (const spec of UNIT_SPECS) {
    const weight = balance.poolShare[spec.pool] * balance.heatMod[heat][spec.pool] * balance.flavourMod[flavour][spec.pool];
    weights[spec.id] = weight;
    sum += weight;
  }
  const budget = Math.max(0, Math.floor(gfaFt2 * balance.presetFill));
  const mix = emptyMix();
  const remainders = {};
  let used = 0;
  for (const spec of UNIT_SPECS) {
    const exact = sum === 0 ? 0 : (weights[spec.id] / sum) * budget / spec.ft2;
    const count = Math.floor(exact);
    remainders[spec.id] = exact - count;
    mix[spec.id] = count;
    used += count * spec.ft2;
  }
  const order = [...UNIT_SPECS].sort((a, b) => remainders[b.id] - remainders[a.id] || a.ft2 - b.ft2);
  let guard = 0;
  while (guard < 8) {
    guard += 1;
    let placed = false;
    for (const spec of order) {
      if (used + spec.ft2 <= budget) {
        mix[spec.id] += 1;
        used += spec.ft2;
        placed = true;
      }
    }
    if (!placed) break;
  }
  return mix;
}

export function sizePools(catalog, { gfaFt2, flavour, heat, buyer = 1, bias = {} }) {
  const { balance } = catalog;
  const pools = {};
  for (const spec of UNIT_SPECS) {
    const feet = gfaFt2 * balance.poolShare[spec.pool] * balance.heatMod[heat][spec.pool] * balance.flavourMod[flavour][spec.pool] * buyer;
    pools[spec.pool] = Math.max(0, Math.round(feet / spec.ft2) + (bias[spec.pool] || 0));
  }
  return pools;
}

export function affordability({ lump, budget, cheer = 0, gains = [] }) {
  let help = 0;
  const steps = Math.max(0, Math.round(Number(cheer) || 0));
  for (let i = 0; i < steps; i += 1) help += gains[i] || 0;
  const bowl = budget * (1 + help);
  const ratio = bowl === 0 ? 0 : lump / bowl;
  return { bowl, lump, help, ratio, ok: lump <= bowl + 1e-6 };
}

export function rollCake({ heat, roll, chance, offered, pool }) {
  if (heat !== "loose") return 0;
  if (offered < 2 || pool < 2) return 0;
  if (!(roll < chance)) return 0;
  const want = roll < chance * 0.5 ? 3 : 2;
  return Math.min(want, offered, pool);
}

export function priceVerdict(ratio, balance) {
  if (ratio >= balance.expensiveAt) return "expensive";
  if (ratio <= balance.cheapAt) return "cheap";
  return "fair";
}

export function pickDistrict(type, rng, balance, used = new Set()) {
  const urban = balance.urbanDistricts;
  const towns = balance.newTownDistricts;
  const all = Object.keys(balance.districtLever);
  let pool = all;
  if (type === "ura") pool = rng.next() < balance.uraUrbanChance ? urban : all;
  else if (type === "mtr") pool = rng.next() < 0.5 ? towns : urban;
  const fresh = pool.filter((district) => !used.has(district));
  const source = fresh.length ? fresh : pool;
  return source[Math.floor(rng.next() * source.length)];
}

function snapGfa(value) {
  return Math.round(value / 100) * 100;
}

function lerp(min, max, t) {
  return min + (max - min) * t;
}

export function priceOffer(skeleton, levels, catalog, heat = "loose") {
  const bench = gameBench(catalog, skeleton.district, levels);
  const spec = catalog.balance.landTypes[skeleton.type];
  const partnerRate = spec.partnerRate;
  const landExact = bench.fairLandPerFt2 * skeleton.premium;
  const buildExact = bench.fairBuildPerFt2;
  const flavour = districtFlavour(skeleton.district, catalog.balance);
  const useHeat = heat === "spicy" ? "spicy" : "loose";
  const mixHint = presetMix(skeleton.gfaFt2, flavour, useHeat, catalog.balance);
  return {
    slot: skeleton.slot,
    type: skeleton.type,
    district: skeleton.district,
    region: bench.region,
    flavour,
    heat: useHeat,
    gfaFt2: skeleton.gfaFt2,
    units: unitTotal(mixHint),
    mixHint,
    premium: skeleton.premium,
    partnerRate,
    quotedAt: {
      price: levels.price,
      land: levels.land,
      build: levels.build,
      buyer: levels.buyer,
    },
    landPerFt2: money(landExact),
    landTotal: money(landExact * skeleton.gfaFt2),
    fairLandPerFt2: money(bench.fairLandPerFt2),
    verdict: priceVerdict(skeleton.premium, catalog.balance),
    estBuildPerFt2: money(buildExact),
    estBuildTotal: money(buildExact * skeleton.gfaFt2),
    openData: bench.open,
    supply: bench.supply,
    lever: bench.lever,
    vacancyPct: bench.vacancyPct,
  };
}

function makeOffer({ slot, type, district, gfaFt2, premium, rng, catalog, levels, used, heat }) {
  const spec = catalog.balance.landTypes[type];
  const picked = district || pickDistrict(type, rng, catalog.balance, used);
  const gfa = gfaFt2 || snapGfa(lerp(spec.gfaMin, spec.gfaMax, rng.next()));
  const prem = premium == null ? lerp(spec.premiumMin, spec.premiumMax, rng.next()) : premium;
  used?.add(picked);
  return priceOffer(
    {
      slot,
      type,
      district: picked,
      gfaFt2: gfa,
      premium: Math.round(prem * 1000) / 1000,
    },
    levels,
    catalog,
    heat,
  );
}

function shuffle(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function tutorialOffers(rng, state, catalog, heat) {
  const guide = catalog.balance.tutorial;
  const used = new Set([guide.district]);
  const rest = shuffle(["ura", "mtr"], rng);
  return [
    makeOffer({
      slot: "A",
      type: "gov",
      district: guide.district,
      gfaFt2: guide.gfaFt2,
      premium: guide.premium,
      rng,
      catalog,
      levels: state.market,
      used,
      heat,
    }),
    makeOffer({ slot: "B", type: rest[0], rng, catalog, levels: state.market, used, heat }),
    makeOffer({ slot: "C", type: rest[1], rng, catalog, levels: state.market, used, heat }),
  ];
}

function randomOffers(rng, state, catalog, heat) {
  const types = shuffle(["ura", "mtr", "gov"], rng);
  const used = new Set();
  return ["A", "B", "C"].map((slot, index) =>
    makeOffer({ slot, type: types[index], rng, catalog, levels: state.market, used, heat }),
  );
}

export function rollOffers(state, catalog) {
  const heat = campaignHeat(state, catalog.balance);
  const { value, rngCursor } = runRng(state, (rng) => {
    if (state.completed === 0) return tutorialOffers(rng, state, catalog, heat);
    return randomOffers(rng, state, catalog, heat);
  });
  return { ...state, rngCursor, offers: value, phase: "land", project: null };
}

export function projectNumber(state) {
  if (state.phase === "summary") return state.completed;
  return state.completed + 1;
}

export function isTutorial(state) {
  return state.completed < 2 && state.phase !== "summary";
}

function drawMove(state, catalog, rng) {
  const base = catalog.balance.drifts[state.market.step % catalog.balance.drifts.length];
  const noise = catalog.balance.driftNoise ? (rng.next() - 0.5) * catalog.balance.driftNoise : 0;
  return round4(base + noise);
}

export function createCampaign(catalog, { company, seed = 1 } = {}) {
  const rngCursor = seed >>> 0;
  const state = {
    v: SAVE_VERSION,
    company: normalizeCompany(company),
    cash: catalog.balance.startingCash,
    reputation: catalog.balance.startingReputation,
    completed: 0,
    phase: "land",
    market: initialMarket(),
    offers: null,
    project: null,
    story: null,
    history: [],
    flags: {},
    unitsSold: 0,
    unitsLaunched: 0,
    seed: seed >>> 0,
    rngCursor,
    poolBias: emptyBias(),
    frozen: [],
    voice: emptyVoice(),
    notice: null,
  };
  return rollOffers(state, catalog);
}

export function skipLand(catalog, state) {
  if (state.phase !== "land") return fail(state, "bad_phase");
  const { value: move, rngCursor } = runRng(state, (rng) => drawMove(state, catalog, rng));
  const market = tickMarket(state.market, move, catalog.balance);
  return succeed({
    ...state,
    rngCursor,
    market,
    offers: null,
    project: { index: state.completed + 1, skipped: true, move },
    phase: "settle",
  });
}

export function chooseLand(catalog, state, slot) {
  if (state.phase !== "land") return fail(state, "bad_phase");
  const offer = (state.offers || []).find((item) => item.slot === slot);
  if (!offer) return fail(state, "bad_slot");
  if (state.cash < offer.landTotal) return fail(state, "insufficient_cash");
  const { value: move, rngCursor } = runRng(state, (rng) => drawMove(state, catalog, rng));
  const market = tickMarket(state.market, move, catalog.balance);
  return succeed({
    ...state,
    rngCursor,
    cash: money(state.cash - offer.landTotal),
    market,
    offers: null,
    phase: "build",
    project: {
      index: state.completed + 1,
      skipped: false,
      name: defaultProjectName(offer.district, offer.flavour),
      offer: {
        ...offer,
        quotedAt: { ...offer.quotedAt },
        openData: { ...offer.openData },
      },
      contractor: null,
      choices: null,
      sale: null,
    },
  });
}

export function contractorQuote(catalog, state, contractorId) {
  const spec = catalog.balance.contractors[contractorId];
  if (!spec || state.project?.offer == null) return null;
  const bench = gameBench(catalog, state.project.offer.district, state.market);
  const base = money(bench.fairBuildPerFt2 * state.project.offer.gfaFt2);
  const cost = money(base * spec.costMul);
  const shortfall = Math.max(0, cost - state.cash);
  const financeFee = shortfall > 0 ? money(shortfall * catalog.balance.financeRate) : 0;
  return {
    id: contractorId,
    costMul: spec.costMul,
    leak: spec.leak,
    collapse: spec.collapse,
    quality: spec.quality,
    rep: spec.rep,
    buildPerFt2: money(bench.fairBuildPerFt2 * spec.costMul),
    cost,
    financeFee,
    total: cost + financeFee,
    overdraft: shortfall > 0,
  };
}

export function rollCollapse(spec, roll) {
  return roll < spec.collapse;
}

export function chooseContractor(catalog, state, contractorId, rawMix) {
  if (state.phase !== "build") return fail(state, "bad_phase");
  const spec = catalog.balance.contractors[contractorId];
  if (!spec) return fail(state, "bad_contractor");
  const flavour = districtFlavour(state.project.offer.district, catalog.balance);
  const heat = campaignHeat(state, catalog.balance);
  const mix = rawMix == null ? presetMix(state.project.offer.gfaFt2, flavour, heat, catalog.balance) : normalizeMix(rawMix);
  if (gfaUsed(mix) <= 0) return fail(state, "empty_mix");
  if (!mixFits(state.project.offer.gfaFt2, mix)) return fail(state, "over_gfa");
  const quote = contractorQuote(catalog, state, contractorId);
  const cashBefore = state.cash;
  const pricedAt = {
    price: state.market.price,
    land: state.market.land,
    build: state.market.build,
    buyer: state.market.buyer,
  };
  const { value, rngCursor } = runRng(state, (rng) => {
    const collapsed = rollCollapse(spec, rng.next());
    const move = drawMove(state, catalog, rng);
    const saleRoll = rng.next();
    return { collapsed, move, saleRoll };
  });
  let quality = spec.quality;
  let leak = spec.leak;
  let extra = 0;
  let rep = spec.rep;
  if (value.collapsed) {
    extra = money(quote.cost * catalog.balance.collapseExtra);
    quality = round4(quality * catalog.balance.collapseQuality);
    leak = Math.min(0.95, round4(leak + catalog.balance.collapseLeakAdd));
    rep += catalog.balance.collapseRep;
  }
  rep += -Math.round(leak * catalog.balance.leakRepWeight);
  const buildBill = quote.cost + extra;
  let financeFee = 0;
  if (cashBefore < buildBill) {
    financeFee = money((buildBill - cashBefore) * catalog.balance.financeRate);
    rep += catalog.balance.overdraftRep;
  }
  const total = buildBill + financeFee;
  const market = tickMarket(state.market, value.move, catalog.balance);
  return succeed({
    ...state,
    rngCursor,
    cash: money(state.cash - total),
    reputation: clamp(state.reputation + rep, 0, 100),
    market,
    phase: "sell",
    project: {
      ...state.project,
      contractor: {
        id: contractorId,
        collapsed: value.collapsed,
        quality,
        leak,
        cost: quote.cost,
        extra,
        financeFee,
        total,
        repDelta: rep,
        overdraft: financeFee > 0,
        pricedAt,
        cashBefore,
      },
      mix,
      saleRoll: value.saleRoll,
      choices: null,
      sale: null,
    },
  });
}

export function normalizeChoices(raw = {}, balance) {
  const cheer = clamp(Math.round(Number(raw.cheer) || 0), 0, balance.cheerMax);
  const showflat = Boolean(raw.showflat);
  const leftover = raw.leftover === "hold" ? "hold" : "cut";
  const price = raw.price === "cheap" || raw.price === "expensive" ? raw.price : "fair";
  return { showflat, cheer, leftover, price, askMul: askMultiplier(price, balance) };
}

function askMultiplier(price, balance) {
  const key = price === "cheap" ? "cheap" : price === "expensive" ? "stretch" : "market";
  const mul = balance.ask?.[key];
  return typeof mul === "number" && mul > 0 ? mul : 1;
}

function priceConvert(askMul, balance) {
  const fair = baseThrough(1, balance) || 1;
  return baseThrough(askMul, balance) / fair;
}

function baseThrough(askMul, balance) {
  for (const band of balance.throughBands) {
    if (askMul <= band.maxMul) return band.through;
  }
  return balance.throughBands[balance.throughBands.length - 1].through;
}

export function priceRisk(askMul) {
  if (askMul <= 0.9) return "loss_risk";
  if (askMul <= 1.05) return "balanced";
  if (askMul <= 1.25) return "slow";
  return "fail_risk";
}

function activeMix(state, flavour, heat, balance) {
  if (state.project.mix && gfaUsed(state.project.mix) > 0) return normalizeMix(state.project.mix);
  if (state.project.offer.mixHint && gfaUsed(state.project.offer.mixHint) > 0) return normalizeMix(state.project.offer.mixHint);
  return presetMix(state.project.offer.gfaFt2, flavour, heat, balance);
}

export function resolveSale(catalog, state, rawChoices, roll) {
  const balance = catalog.balance;
  const choices = normalizeChoices(rawChoices, balance);
  const offer = state.project.offer;
  const contractor = state.project.contractor;
  const flavour = offer.flavour || districtFlavour(offer.district, balance);
  const marketHeat = campaignHeat(state, balance);
  const mix = activeMix(state, flavour, marketHeat, balance);
  const bench = gameBench(catalog, offer.district, state.market);
  const leakDrag = 1 - contractor.leak * balance.leakPriceDrag;
  const fairPerFt2 = bench.fairSalePerFt2 * contractor.quality * leakDrag;
  const buyer = state.market?.buyer || 1;
  const poolsBefore = sizePools(catalog, {
    gfaFt2: offer.gfaFt2,
    flavour,
    heat: marketHeat,
    buyer,
    bias: state.poolBias || emptyBias(),
  });
  const usedRoll = typeof rawChoices?.roll === "number"
    ? rawChoices.roll
    : typeof roll === "number"
      ? roll
      : typeof state.project?.saleRoll === "number"
        ? state.project.saleRoll
        : 1;
  const askMul = choices.askMul;
  const pricedConvert = priceConvert(askMul, balance);
  const twoAsk = fairPerFt2 * 450 * askMul;
  const bowlRaw = affordability({
    lump: twoAsk,
    budget: balance.starterBudget * buyer,
    cheer: choices.cheer,
    gains: balance.cheerBowl,
  });
  const studioAsk = fairPerFt2 * 280 * askMul;
  const whaleBudget = balance.whaleBudget * buyer * (marketHeat === "loose" ? balance.looseWhaleMul : balance.spicyWhaleMul);
  const whaleSensitive = studioAsk > whaleBudget;
  let cheerBonus = 0;
  for (let i = 0; i < choices.cheer; i += 1) cheerBonus += balance.cheerGains[i] || 0;
  const cakeSweep = rollCake({
    heat: marketHeat,
    roll: usedRoll,
    chance: balance.cakeChance,
    offered: mix.studio,
    pool: poolsBefore.whale,
  });
  const byType = {};
  const poolsAfter = { ...poolsBefore };
  let grossExact = 0;
  let fireExact = 0;
  let frozenExact = 0;
  let sold = 0;
  let units = 0;
  for (const spec of UNIT_SPECS) {
    const offered = mix[spec.id];
    units += offered;
    const ask = fairPerFt2 * spec.ft2 * askMul;
    let convert = balance.baseConvert[spec.id] + cheerBonus;
    if (choices.showflat) convert += balance.showflatBoost[spec.id];
    if (spec.id === "studio" && marketHeat === "loose") convert += balance.looseStudio;
    if (spec.id !== "studio" && marketHeat === "spicy") convert += balance.spicyLiveIn;
    if (contractor.collapsed) convert -= balance.collapseThrough;
    if (spec.id === "two" && !bowlRaw.ok) convert *= balance.bowlCrack;
    if (spec.id === "studio" && whaleSensitive) convert *= balance.whalePriceCut;
    convert *= pricedConvert;
    convert = clamp(convert, 0.05, 0.98);
    const pool = poolsBefore[spec.pool];
    let soldN = Math.min(offered, Math.round(pool * convert));
    if (spec.id === "studio" && cakeSweep > 0) soldN = Math.min(offered, Math.max(soldN, cakeSweep));
    soldN = Math.max(0, Math.min(soldN, pool, offered));
    const unsoldN = offered - soldN;
    poolsAfter[spec.pool] = pool - soldN;
    grossExact += soldN * ask;
    if (unsoldN > 0 && choices.leftover === "cut") fireExact += unsoldN * ask * balance.fireSale;
    if (unsoldN > 0 && choices.leftover === "hold") frozenExact += unsoldN * ask * balance.holdRecover;
    sold += soldN;
    byType[spec.id] = {
      offered,
      sold: soldN,
      unsold: unsoldN,
      ask: money(ask),
      convert: round4(convert),
      poolBefore: pool,
      poolAfter: pool - soldN,
      sensitive: spec.id === "studio" ? whaleSensitive : false,
    };
  }
  const gross = money(grossExact);
  const fireGross = money(fireExact);
  const frozenAmount = choices.leftover === "hold" ? money(frozenExact) : 0;
  const showflatCost = choices.showflat ? money(balance.showflatPerFt2 * offer.gfaFt2) : 0;
  const partnerOnSales = money(gross * offer.partnerRate);
  const firePartner = money(fireGross * offer.partnerRate);
  const partnerShare = partnerOnSales + firePartner;
  const fireNet = fireGross - firePartner;
  const netCash = money(gross - showflatCost - partnerOnSales + fireNet);
  const profit = netCash - offer.landTotal - contractor.total;
  const unsold = units - sold;
  const ratio = units === 0 ? 0 : sold / units;
  let outcome = "fail";
  if (units > 0 && (sold === units || ratio >= balance.clearAt)) outcome = "clear";
  else if (ratio >= balance.partialAt) outcome = "partial";
  const through = units === 0 ? 0 : sold / units;
  const heat = Math.round(clamp(through, 0, 1) * 100);
  let reputationDelta = outcome === "clear" ? balance.repClear : outcome === "partial" ? balance.repPartial : balance.repFail;
  if (profit < 0) reputationDelta += balance.repLoss;
  if (unsold > 0 && choices.leftover === "cut") reputationDelta += balance.repCut;
  if (unsold > 0 && choices.leftover === "hold") reputationDelta += balance.repHold;
  const perUnit = units ? money(grossExact / Math.max(sold, 1)) : 0;
  return {
    choices,
    marketHeat,
    flavour,
    mix,
    byType,
    poolsBefore,
    poolsAfter,
    bowl: {
      bowl: money(bowlRaw.bowl),
      lump: money(twoAsk),
      ratio: round4(bowlRaw.ratio),
      ok: bowlRaw.ok,
      help: round4(bowlRaw.help),
    },
    whaleSensitive,
    whaleBudget: money(whaleBudget),
    cakeSweep,
    showflatCost,
    fairPerFt2: money(fairPerFt2),
    askPerUnit: perUnit,
    through,
    sold,
    unsold,
    units,
    outcome,
    heat,
    gross,
    fireGross,
    fireNet,
    frozenAmount,
    partnerShare,
    partnerOnSales,
    netCash,
    profit,
    reputationDelta,
  };
}

const LEFT_RANK = { none: 0, few: 1, some: 2, many: 3 };

export function saleForecast(catalog, state, rawChoices) {
  const preview = resolveSale(catalog, state, { ...rawChoices, cheer: 0, roll: 1 });
  const units = preview.units;
  const unsold = preview.unsold;
  const ratio = units ? unsold / units : 0;
  let left = "none";
  if (unsold > 0 && ratio < 0.12) left = "few";
  else if (unsold > 0 && ratio < 0.35) left = "some";
  else if (unsold > 0) left = "many";
  let sticky = null;
  let stickyUnsold = 0;
  for (const spec of UNIT_SPECS) {
    const row = preview.byType[spec.id];
    if (row && row.unsold > stickyUnsold) {
      sticky = spec.id;
      stickyUnsold = row.unsold;
    }
  }
  return {
    sellsOut: preview.outcome === "clear",
    left,
    leftRank: LEFT_RANK[left],
    sticky: unsold > 0 ? sticky : null,
    price: preview.choices.price,
    outcome: preview.outcome,
  };
}

export function saleReveal(sold, cheer, cheerMax = 3) {
  const steps = Math.max(1, Math.round(Number(cheerMax) || 0) || 3);
  const used = clamp(Math.round(Number(cheer) || 0), 0, steps);
  const total = Math.max(0, Math.round(Number(sold) || 0));
  if (used >= steps) return { shown: total, done: true, cheerLeft: 0 };
  const cap = 0.34 + (used / steps) * 0.5;
  return { shown: Math.min(total, Math.round(total * cap)), done: false, cheerLeft: steps - used };
}

export function saleQuality(contractor, showflat) {
  let score = Number(contractor?.quality) || 1;
  if (showflat) score += 0.08;
  if (contractor?.collapsed) score -= 0.06;
  if ((contractor?.leak || 0) >= 0.3) score -= 0.05;
  return round4(score);
}

export function emptyVoice() {
  return { n: 0, price: 0, quality: 1, stuck: 0 };
}

const PRICE_CODE = { cheap: -1, fair: 0, expensive: 1 };
const STANCE_EDGE = 0.4;

function commentHistoryWeight(n) {
  if (!n || n <= 1) return 0.22;
  return Math.min(0.62, 0.34 + n * 0.1);
}

function stanceFromScore(score) {
  if (score <= -STANCE_EDGE) return "cheap";
  if (score >= STANCE_EDGE) return "expensive";
  return "fair";
}

export function pushVoice(voice, sample) {
  const n0 = voice?.n || 0;
  const n = n0 + 1;
  const w = n0 === 0 ? 1 : 1 / Math.min(n, 3);
  const code = PRICE_CODE[sample.price] ?? 0;
  const stuck = sample.price === "expensive" && sample.unsoldRatio >= 0.25 ? 1 : 0;
  return {
    n,
    price: round4((n0 ? voice.price : 0) * (1 - w) + code * w),
    quality: round4((n0 ? voice.quality : sample.quality) * (1 - w) + sample.quality * w),
    stuck: round4((n0 ? voice.stuck : 0) * (1 - w) + stuck * w),
  };
}

function blendedSample(sample, voice) {
  if (!voice?.n) return sample;
  const code = PRICE_CODE[sample.price] ?? 0;
  const weight = commentHistoryWeight(voice.n);
  const priceScore = voice.price * weight + code * (1 - weight);
  const quality = voice.quality * weight + sample.quality * (1 - weight);
  const stuck = voice.stuck * weight + (sample.unsoldRatio >= 0.25 ? 1 : 0) * (1 - weight);
  return {
    price: stanceFromScore(priceScore),
    quality,
    unsoldRatio: Math.max(sample.unsoldRatio || 0, stuck >= 0.5 ? 0.25 : 0),
  };
}

export function marketComment(sample, voice = null) {
  const view = blendedSample(sample, voice);
  const good = view.quality >= 1.05;
  const bad = view.quality < 0.94;
  const pricey = view.price === "expensive";
  const cheap = view.price === "cheap";
  if (pricey && (view.unsoldRatio >= 0.25 || bad)) return "dearEmpty";
  if (cheap && good && view.unsoldRatio < 0.25) return "valueGood";
  if (cheap && bad) return "cheapBad";
  if (pricey && good) return "dearGood";
  if (cheap) return "cheapMid";
  if (pricey) return "dearMid";
  if (bad) return "fairBad";
  if (good) return "fairGood";
  return "fairMid";
}

export function voiceComment(voice) {
  if (!voice?.n) return null;
  return marketComment({
    price: stanceFromScore(voice.price),
    quality: voice.quality,
    unsoldRatio: voice.stuck >= 0.5 ? 0.4 : 0,
  });
}

export function commentSample(project) {
  const sale = project?.sale;
  const units = sale?.units || 0;
  return {
    price: sale?.choices?.price || "fair",
    quality: saleQuality(project?.contractor, Boolean(sale?.choices?.showflat)),
    unsoldRatio: units ? (sale.unsold || 0) / units : 0,
  };
}

export function commitSale(catalog, state, choices) {
  if (state.phase !== "sell") return fail(state, "bad_phase");
  const normalized = normalizeChoices(choices, catalog.balance);
  let roll = state.project.saleRoll;
  let rngCursor = state.rngCursor;
  if (typeof choices?.roll === "number") roll = choices.roll;
  else if (typeof roll !== "number") {
    const stepped = runRng(state, (rng) => rng.next());
    roll = stepped.value;
    rngCursor = stepped.rngCursor;
  }
  const sale = resolveSale(catalog, state, { ...normalized, roll }, roll);
  return succeed({
    ...state,
    rngCursor,
    phase: "settle",
    project: { ...state.project, choices: normalized, sale, saleRoll: roll },
  });
}

export function pickStory(stories, rng, { previousId = null, govLand = false, weight = 4 } = {}) {
  const pool = stories.filter((story) => story.id !== previousId);
  const source = pool.length ? pool : stories;
  const weights = source.map((story) => (govLand && story.controversy ? weight : 1));
  const total = weights.reduce((sum, item) => sum + item, 0);
  let cursor = rng.next() * total;
  for (let i = 0; i < source.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return source[i];
  }
  return source[source.length - 1];
}

function cloneStory(story) {
  return {
    id: story.id,
    tc: story.tc,
    en: story.en,
    controversy: Boolean(story.controversy),
    choices: story.choices.map((choice) => ({
      ...choice,
      pool: choice.pool ? { ...choice.pool } : undefined,
    })),
  };
}

function takeStory(state, catalog) {
  const last = state.history[state.history.length - 1];
  const govLand = Boolean(last && last.type === "gov" && !last.skipped);
  const { value, rngCursor } = runRng(state, (rng) => pickStory(STORIES, rng, {
    previousId: state.story?.id,
    govLand,
    weight: catalog.balance.controversyWeight,
  }));
  return { ...state, rngCursor, story: cloneStory(value) };
}

export function confirmSettle(catalog, state) {
  if (state.phase !== "settle") return fail(state, "bad_phase");
  let cash = state.cash;
  let reputation = state.reputation;
  let unitsSold = state.unitsSold;
  let unitsLaunched = state.unitsLaunched;
  let voice = state.voice || emptyVoice();
  const frozen = (state.frozen || []).map((item) => ({ ...item }));
  let entry;
  if (state.project?.skipped) {
    entry = {
      index: state.completed + 1,
      skipped: true,
      district: null,
      type: null,
      flavour: null,
      heat: campaignHeat(state, catalog.balance),
      outcome: "skip",
      profit: 0,
      sold: 0,
      units: 0,
      partnerShare: 0,
      cakeSweep: 0,
    };
  } else {
    const sale = state.project.sale;
    cash = money(cash + sale.netCash);
    reputation = clamp(reputation + sale.reputationDelta, 0, 100);
    unitsSold += sale.sold;
    unitsLaunched += sale.units;
    if (sale.frozenAmount > 0) frozen.push({ releaseAt: state.completed + 2, amount: sale.frozenAmount });
    entry = {
      index: state.completed + 1,
      skipped: false,
      district: state.project.offer.district,
      type: state.project.offer.type,
      flavour: state.project.offer.flavour || null,
      heat: sale.marketHeat,
      outcome: sale.outcome,
      profit: sale.profit,
      sold: sale.sold,
      units: sale.units,
      partnerShare: sale.partnerShare,
      cakeSweep: sale.cakeSweep,
      name: state.project.name || defaultProjectName(state.project.offer.district, state.project.offer.flavour),
      mix: normalizeMix(state.project.mix),
      price: sale.choices?.price || "fair",
      leftover: sale.choices?.leftover || "cut",
      unsold: sale.unsold,
      reputationDelta: sale.reputationDelta,
      comment: marketComment(commentSample(state.project), voice),
    };
    voice = pushVoice(voice, commentSample(state.project));
  }
  const completed = state.completed + 1;
  let released = 0;
  const keep = [];
  for (const item of frozen) {
    if (item.releaseAt <= completed) released += item.amount;
    else keep.push(item);
  }
  if (completed >= catalog.balance.projects) {
    for (const item of keep) released += item.amount;
    keep.length = 0;
  }
  cash = money(cash + released);
  const history = [...state.history, entry];
  const base = {
    ...state,
    cash,
    reputation,
    unitsSold,
    unitsLaunched,
    completed,
    history,
    voice,
    frozen: keep,
    offers: null,
    project: null,
  };
  if (completed >= catalog.balance.projects) {
    return succeed({ ...base, phase: "summary", story: null });
  }
  return succeed({ ...takeStory(base, catalog), phase: "story" });
}

export function chooseStory(catalog, state, choiceId) {
  if (state.phase !== "story") return fail(state, "bad_phase");
  const choice = (state.story?.choices || []).find((item) => item.id === choiceId);
  if (!choice) return fail(state, "bad_choice");
  const flags = { ...state.flags };
  if (choice.flag) flags[choice.flag] = true;
  const poolBias = { ...emptyBias(), ...(state.poolBias || {}) };
  if (choice.pool) {
    for (const key of POOLS) {
      if (typeof choice.pool[key] === "number") poolBias[key] += choice.pool[key];
    }
  }
  const next = {
    ...state,
    flags,
    poolBias,
    cash: money(state.cash + (choice.cash || 0)),
    reputation: clamp(state.reputation + (choice.rep || 0), 0, 100),
    story: { ...state.story, picked: choiceId },
  };
  return succeed(rollOffers(next, catalog));
}

function slimOffer(offer) {
  if (!offer) return null;
  return {
    slot: offer.slot,
    type: offer.type,
    district: offer.district,
    gfaFt2: offer.gfaFt2,
    premium: offer.premium,
    quotedAt: offer.quotedAt,
  };
}

export function serializeCampaign(state) {
  return {
    v: SAVE_VERSION,
    company: state.company,
    cash: state.cash,
    reputation: state.reputation,
    completed: state.completed,
    phase: state.phase,
    market: state.market,
    seed: state.seed,
    rngCursor: state.rngCursor,
    flags: state.flags,
    unitsSold: state.unitsSold,
    unitsLaunched: state.unitsLaunched,
    poolBias: { ...emptyBias(), ...(state.poolBias || {}) },
    voice: { ...emptyVoice(), ...(state.voice || {}) },
    frozen: (state.frozen || []).map((item) => ({ ...item })),
    history: state.history.map((item) => ({ ...item })),
    story: state.story ? { id: state.story.id, picked: state.story.picked || null } : null,
    offers: (state.offers || []).map(slimOffer),
    project: state.project
      ? {
          index: state.project.index,
          skipped: Boolean(state.project.skipped),
          name: state.project.name || null,
          move: state.project.move ?? null,
          offer: slimOffer(state.project.offer),
          contractor: state.project.contractor
            ? {
                id: state.project.contractor.id,
                collapsed: Boolean(state.project.contractor.collapsed),
                pricedAt: state.project.contractor.pricedAt,
                cashBefore: state.project.contractor.cashBefore,
              }
            : null,
          mix: state.project.mix ? { ...state.project.mix } : null,
          choices: state.project.choices || null,
          saleRoll: typeof state.project.saleRoll === "number" ? state.project.saleRoll : null,
        }
      : null,
  };
}

function rehydrateContractor(saved, offer, catalog) {
  if (!saved?.id || !saved.pricedAt) return null;
  const spec = catalog.balance.contractors[saved.id];
  if (!spec) return null;
  const quote = contractorQuote(
    catalog,
    { cash: Number.MAX_SAFE_INTEGER, project: { offer }, market: saved.pricedAt },
    saved.id,
  );
  let quality = spec.quality;
  let leak = spec.leak;
  let extra = 0;
  let rep = spec.rep;
  if (saved.collapsed) {
    extra = money(quote.cost * catalog.balance.collapseExtra);
    quality = round4(quality * catalog.balance.collapseQuality);
    leak = Math.min(0.95, round4(leak + catalog.balance.collapseLeakAdd));
    rep += catalog.balance.collapseRep;
  }
  rep += -Math.round(leak * catalog.balance.leakRepWeight);
  const buildBill = quote.cost + extra;
  const cashBefore = typeof saved.cashBefore === "number" ? saved.cashBefore : buildBill;
  let financeFee = 0;
  if (cashBefore < buildBill) {
    financeFee = money((buildBill - cashBefore) * catalog.balance.financeRate);
    rep += catalog.balance.overdraftRep;
  }
  return {
    id: saved.id,
    collapsed: Boolean(saved.collapsed),
    quality,
    leak,
    cost: quote.cost,
    extra,
    financeFee,
    total: buildBill + financeFee,
    repDelta: rep,
    overdraft: financeFee > 0,
    pricedAt: saved.pricedAt,
    cashBefore,
  };
}

export function hydrateCampaign(catalog, saved) {
  if (!saved || saved.v !== SAVE_VERSION) throw new Error("unsupported save");
  if (!PHASES.includes(saved.phase)) throw new Error("unsupported save");
  const state = {
    v: SAVE_VERSION,
    company: normalizeCompany(saved.company),
    cash: money(saved.cash),
    reputation: clamp(saved.reputation, 0, 100),
    completed: clamp(saved.completed || 0, 0, catalog.balance.projects),
    phase: saved.phase,
    market: { ...saved.market },
    seed: saved.seed >>> 0,
    rngCursor: saved.rngCursor >>> 0,
    flags: { ...(saved.flags || {}) },
    unitsSold: saved.unitsSold || 0,
    unitsLaunched: saved.unitsLaunched || 0,
    poolBias: { ...emptyBias(), ...(saved.poolBias || {}) },
    voice: {
      n: saved.voice?.n || 0,
      price: Number(saved.voice?.price) || 0,
      quality: typeof saved.voice?.quality === "number" ? saved.voice.quality : 1,
      stuck: Number(saved.voice?.stuck) || 0,
    },
    frozen: Array.isArray(saved.frozen) ? saved.frozen.map((item) => ({ ...item })) : [],
    history: Array.isArray(saved.history) ? saved.history.map((item) => ({ ...item })) : [],
    notice: null,
    offers: null,
    project: null,
    story: null,
  };
  const heat = campaignHeat(state, catalog.balance);
  if (Array.isArray(saved.offers)) {
    state.offers = saved.offers.map((offer) => priceOffer(offer, offer.quotedAt, catalog, heat));
  }
  if (saved.project?.skipped) {
    state.project = { index: saved.project.index, skipped: true, move: saved.project.move };
  } else if (saved.project?.offer) {
    const offer = priceOffer(saved.project.offer, saved.project.offer.quotedAt, catalog, heat);
    const contractor = rehydrateContractor(saved.project.contractor, offer, catalog);
    state.project = {
      index: saved.project.index,
      skipped: false,
      name: normalizeProjectName(saved.project.name, defaultProjectName(offer.district, offer.flavour)),
      offer,
      contractor,
      mix: saved.project.mix ? normalizeMix(saved.project.mix) : null,
      choices: saved.project.choices || null,
      saleRoll: typeof saved.project.saleRoll === "number" ? saved.project.saleRoll : null,
      sale: null,
    };
    if (state.phase === "settle" && contractor) {
      state.project.sale = resolveSale(catalog, state, {
        ...(saved.project.choices || {}),
        roll: state.project.saleRoll,
      });
    }
  }
  if (saved.story?.id) {
    const found = STORIES.find((story) => story.id === saved.story.id) || STORIES[0];
    state.story = { ...cloneStory(found), picked: saved.story.picked || null };
  }
  return state;
}

function upgradeV3(raw) {
  const history = Array.isArray(raw.history)
    ? raw.history.map((item) => ({
        name: null,
        mix: null,
        price: null,
        leftover: null,
        unsold: null,
        reputationDelta: null,
        comment: null,
        ...item,
      }))
    : [];
  return {
    ...raw,
    v: SAVE_VERSION,
    voice: raw.voice || emptyVoice(),
    history,
    project: raw.project ? { name: null, ...raw.project } : raw.project ?? null,
  };
}

export function migrateSave(raw) {
  if (!raw) return { ok: false, notice: null, state: null };
  if (raw.goals || raw.v === 1 || raw.v === 2) return { ok: false, notice: "phase1_reset", state: null };
  if (raw.v === SAVE_VERSION) return { ok: true, notice: null, state: raw };
  if (raw.v === 3) return { ok: true, notice: null, state: upgradeV3(raw) };
  return { ok: false, notice: "phase1_reset", state: null };
}

export function endSummary(state) {
  return {
    cash: state.cash,
    reputation: state.reputation,
    unitsSold: state.unitsSold,
    unitsLaunched: state.unitsLaunched,
    projects: state.completed,
    flags: { ...state.flags },
    history: state.history.map((item) => ({ ...item })),
  };
}
