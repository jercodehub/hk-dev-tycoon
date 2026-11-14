/**
 * Phase 3 campaign. No DOM.
 * One project = land → build → sell → settle → story. A run is 30 projects.
 * Unit mix, buyer pools, and spicy/loose heat live here.
 * Region prices still scale the model. The screen does not print them.
 */

import { DISTRICTS } from "./i18n.js";
import { STORIES } from "./stories.js";

export const SAVE_VERSION = 8;
export const CAPITAL_ASSETS = {
  builder: { cost: 180000000, level: "builder", label: "建築公司" },
  manager: { cost: 160000000, level: "manager", label: "物管公司" },
  landBank: { cost: 220000000, level: "landBank", label: "農地／工商地土地銀行" },
  ai: { cost: 200000000, level: "ai", label: "AI 新創投資" },
  district: { cost: 450000000, level: "district", label: "片區開發" },
};
export const ASSEMBLY_OPTIONS = {
  standard: { costMul: 1, gfaMul: 1 },
  modular: { costMul: 0.92, gfaMul: 1.06 },
};

// The in-house builder improves with every project it delivers.
export const OWN_LEVELS = [
  { level: 1, min: 0, costMul: 0.8, leak: 0.08, collapse: 0.02, quality: 1.04 },
  { level: 2, min: 5, costMul: 0.78, leak: 0.06, collapse: 0.012, quality: 1.06 },
  { level: 3, min: 12, costMul: 0.76, leak: 0.04, collapse: 0.006, quality: 1.08 },
];

export function ownLevel(ownBuilds = 0) {
  let current = OWN_LEVELS[0];
  for (const step of OWN_LEVELS) if (ownBuilds >= step.min) current = step;
  return current;
}

export function ownSpec(balance, ownBuilds = 0) {
  const base = balance?.contractors?.own;
  if (!base) return null;
  const step = ownLevel(ownBuilds);
  return { ...base, costMul: step.costMul, leak: step.leak, collapse: step.collapse, quality: step.quality, level: step.level };
}

function withOwnLevel(catalog, state) {
  const spec = ownSpec(catalog.balance, state?.ownBuilds || 0);
  if (!spec) return catalog;
  return { ...catalog, balance: { ...catalog.balance, contractors: { ...catalog.balance.contractors, own: spec } } };
}

// Property-management fee: $5 per ft2 per month, charged once per project
// against every unit the company has sold so far.
export const MANAGEMENT_FEE_PER_FT2_YEAR = 60;

export function emptyAssets() {
  return { builder: 0, manager: 0, landBank: 0, ai: 0, district: 0, invested: 0 };
}

export function investCapital(catalog, state, assetId) {
  const asset = CAPITAL_ASSETS[assetId];
  if (!asset || !state || ["gameover", "summary"].includes(state.phase)) return fail(state, "bad_asset");
  const assets = { ...emptyAssets(), ...(state.assets || {}) };
  if (assets[asset.level] >= 1 || state.cash < asset.cost) return fail(state, "insufficient_cash");
  assets[asset.level] = 1;
  assets.invested = money((assets.invested || 0) + asset.cost);
  return succeed({ ...state, cash: money(state.cash - asset.cost), assets });
}

function assetIncome(state) {
  const assets = state.assets || {};
  return money((assets.ai ? 4000000 : 0) + (assets.district ? 12000000 : 0));
}
export const JV_SHARES = [0.25, 0.35, 0.5];
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
const PHASES = ["land", "build", "sell", "settle", "story", "summary", "gameover"];
const LOAN_MODES = ["cash", "small", "big"];
export const COMPANY_LOGOS = ["tower", "wave", "diamond", "gate", "sun", "monogram"];
export const COMPANY_COLORS = ["#e2b15a", "#6ea2ff", "#e06b6b", "#3ecf8e", "#c084fc", "#f4f1ea"];
export const CHAIR_AVATARS = ["crop", "bob", "glasses", "bun", "wave", "fringe"];

export function money(value) {
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function fail(state, error, details = null) {
  return { ok: false, error, state, ...(details || {}) };
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
  const chairName = String(input.chairName || "主席").trim().slice(0, 10) || "主席";
  const avatar = CHAIR_AVATARS.includes(input.avatar) ? input.avatar : CHAIR_AVATARS[0];
  return { name, logo, color, chairName, avatar };
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
  if (balance.projects !== 30) throw new Error("campaign is exactly 30 projects");
  if ((balance.landTypes.gov.partnerRate || 0) !== 0) throw new Error("government land takes no profit share");
  if ((balance.landTypes.gov.profitShareMax || 0) !== 0) throw new Error("government land takes no profit share");
  if (balance.heatEvery !== 5) throw new Error("heat flips every 5 projects");
  if (balance.flagshipFrom !== 16) throw new Error("flagship window opens at project 16");
  const mtrShare = balance.landTypes.mtr;
  if (mtrShare.profitShareMin < 0.2 || mtrShare.profitShareMax > 0.3) {
    throw new Error("mtr profit share must sit in 20–30%");
  }
  const uraShare = balance.landTypes.ura;
  if (uraShare.profitShareMin < 0.3 || uraShare.profitShareMax > 0.4) {
    throw new Error("ura surplus share must sit in 30–40%");
  }
  if (uraShare.premiumMin < 0.9 || uraShare.premiumMax > 1.08) {
    throw new Error("ura premiums stay mid or slightly cheap");
  }
  const sellBoost = balance.landTypes?.mtr?.sellBoost;
  if (typeof sellBoost !== "number" || sellBoost < 0.08 || sellBoost > 0.12) {
    throw new Error("mtr sellBoost must be +8 to +12 percentage points");
  }
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

export const INDEX_BASE = 300;

export function deriveMarket(price, balance) {
  const level = clamp(round4(price), balance.indexMin, balance.indexMax);
  const scale = (power) => round4(clamp(Math.pow(level, power), balance.indexMin, balance.indexMax));
  return {
    price: level,
    land: scale(balance.landElasticity),
    build: scale(balance.buildElasticity),
    buyer: scale(balance.buyerElasticity),
  };
}

export function hydrateMarket(saved = {}, balance) {
  const price = Number(saved.price) || 1;
  const base = deriveMarket(price, balance);
  const trail = Array.isArray(saved.history) && saved.history.length
    ? saved.history.map((value) => Number(value) || base.price).slice(-12)
    : [base.price];
  return {
    ...base,
    step: Number(saved.step) || 0,
    lastMove: Number(saved.lastMove) || 0,
    history: trail,
    ...(saved.event ? { event: saved.event } : {}),
  };
}

export function marketIndex(market) {
  return Math.round((market?.price || 1) * INDEX_BASE * 10) / 10;
}

export function initialMarket() {
  return { price: 1, land: 1, build: 1, buyer: 1, step: 0, lastMove: 0, history: [1] };
}

export const MARKET_EVENTS = [
  { id: "rate-cut", landMul: 0.98, buildMul: 0.98, buyerMul: 1.03 },
  { id: "rate-hike", landMul: 1.02, buildMul: 1.04, buyerMul: 0.97 },
  { id: "rail-announcement", landMul: 1.05, buildMul: 1, buyerMul: 1.10 },
  { id: "materials-spike", landMul: 1, buildMul: 1.10, buyerMul: 0.98 },
  { id: "cooling-market", landMul: 0.96, buildMul: 0.99, buyerMul: 0.88 },
];

export function effectiveMarket(levels = {}) {
  const event = levels.event || {};
  return {
    ...levels,
    land: (levels.land || 1) * (event.landMul || 1),
    build: (levels.build || 1) * (event.buildMul || 1),
    buyer: (levels.buyer || 1) * (event.buyerMul || 1),
  };
}

export function tickMarket(market, move, balance) {
  const price = clamp(round4(market.price * (1 + move)), balance.indexMin, balance.indexMax);
  const { land, build, buyer } = deriveMarket(price, balance);
  const history = [...(market.history || [market.price]), price].slice(-12);
  const step = market.step + 1;
  const event = step > 0 && step % 5 === 0
    ? { ...MARKET_EVENTS[(step / 5 - 1) % MARKET_EVENTS.length], startedAt: step }
    : market.event || null;
  return { price, land, build, buyer, step, lastMove: round4(move), history, ...(event ? { event } : {}) };
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
  levels = effectiveMarket(levels);
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
  const heats = activeEffects(state).filter((effect) => effect.heat);
  const forced = heats.find((effect) => effect.force);
  if (forced) return forced.heat === "spicy" ? "spicy" : "loose";
  if (heats.length) return heats[heats.length - 1].heat === "spicy" ? "spicy" : "loose";
  const every = balance.heatEvery || 5;
  const block = Math.floor((state?.completed || 0) / every);
  const looseStart = ((state?.seed || 0) % 2) === 0;
  const loose = block % 2 === 0 ? looseStart : !looseStart;
  return loose ? "loose" : "spicy";
}

export function heatProjectsLeft(state, balance) {
  const every = Math.max(1, balance?.heatEvery || 5);
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

export const MIX_PRESETS = ["studio", "starter", "upgrade", "luxury"];

const PRESET_ORDER = {
  studio: ["studio", "one", "two", "three", "feature"],
  starter: ["two", "one", "three", "studio", "feature"],
  upgrade: ["three", "two", "feature", "one", "studio"],
  luxury: ["feature", "three", "two", "one", "studio"],
};

export function mixDelta(gfaFt2) {
  const nominal = Math.floor(Math.max(0, Number(gfaFt2) || 0) / 450);
  if (nominal >= 8000) return 200;
  if (nominal >= 2000) return 50;
  if (nominal >= 400) return 10;
  return 1;
}

export function formatCount(value) {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) {
    const wan = abs / 10000;
    const text = Number.isInteger(wan) ? String(wan) : wan.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text}萬`;
  }
  if (abs >= 1000) {
    const qian = abs / 1000;
    const text = Number.isInteger(qian) ? String(qian) : qian.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text}千`;
  }
  return `${sign}${abs}`;
}

export function mixPreset(gfaFt2, preset) {
  const order = PRESET_ORDER[preset] || PRESET_ORDER.starter;
  const specs = Object.fromEntries(UNIT_SPECS.map((spec) => [spec.id, spec]));
  const mix = emptyMix();
  let left = Math.max(0, Math.floor(Number(gfaFt2) || 0));
  const place = (size) => {
    let guard = 0;
    while (guard < 100000) {
      guard += 1;
      let placed = false;
      for (const id of order) {
        if (specs[id].ft2 * size <= left) {
          const room = Math.floor(left / specs[id].ft2);
          const add = Math.min(size, room);
          mix[id] += add;
          left -= specs[id].ft2 * add;
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }
  };
  const step = mixDelta(gfaFt2);
  if (step > 1) place(step);
  place(1);
  return mix;
}

export function canAddUnits(gfaFt2, mix, unitId, delta = 1) {
  const spec = UNIT_SPECS.find((item) => item.id === unitId);
  const step = Math.max(1, Math.floor(Number(delta) || 1));
  if (!spec) return false;
  return canAddUnit(gfaFt2, mix, unitId) && step >= 1;
}

export function addUnits(gfaFt2, mix, unitId, delta) {
  const spec = UNIT_SPECS.find((item) => item.id === unitId);
  const next = normalizeMix(mix);
  if (!spec) return next;
  const room = Math.floor(gfaRemaining(gfaFt2, next) / spec.ft2);
  const step = Math.max(1, Math.floor(Math.abs(Number(delta) || 1)));
  if (delta < 0) next[unitId] = Math.max(0, next[unitId] - step);
  else next[unitId] += Math.max(0, Math.min(step, room));
  return next;
}

export function canAddUnit(gfaFt2, mix, unitId) {
  const spec = UNIT_SPECS.find((item) => item.id === unitId);
  if (!spec) return false;
  const next = normalizeMix(mix);
  next[unitId] += 1;
  return mixFits(gfaFt2, next);
}

export function unitPopularity(flavour, heat, balance) {
  const useHeat = heat === "spicy" ? "spicy" : "loose";
  const out = {};
  for (const spec of UNIT_SPECS) {
    const score = round4(balance.heatMod[useHeat][spec.pool] * balance.flavourMod[flavour][spec.pool]);
    let band = "mid";
    if (score >= 1.15) band = "high";
    else if (score <= 0.9) band = "low";
    out[spec.id] = { band, score };
  }
  return out;
}

const POP_PLACE = { uni: "近大學", starter: "偏遠", core: "核心" };
const POP_HEAT = { loose: "收租旺", spicy: "上車旺" };

export function popularityNote(flavour, heat, band) {
  if (band === "mid") return "";
  const place = POP_PLACE[flavour] || "";
  const market = POP_HEAT[heat === "spicy" ? "spicy" : "loose"] || "";
  return place && market ? `${place}＋${market}` : "";
}

export function sizePools(catalog, { gfaFt2, flavour, heat, buyer = 1, bias = {}, poolMul = null }) {
  const { balance } = catalog;
  const mods = poolMul || { whale: 1, couple: 1, starter: 1, upgrader: 1, feature: 1 };
  const pools = {};
  for (const spec of UNIT_SPECS) {
    const feet = gfaFt2 * balance.poolShare[spec.pool] * balance.heatMod[heat][spec.pool] * balance.flavourMod[flavour][spec.pool] * buyer * (mods[spec.pool] || 1);
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
  const urban = balance.urbanDistricts || [];
  const towns = balance.newTownDistricts || [];
  const all = Object.keys(balance.districtLever);
  let pool = all;
  if (type === "ura") pool = urban;
  else if (type === "mtr") pool = rng.next() < 0.5 ? towns : urban;
  else if (type === "gov") {
    const chance = typeof balance.govTownChance === "number" ? balance.govTownChance : 0.8;
    pool = rng.next() < chance ? towns : urban;
  }
  const fresh = pool.filter((district) => !used.has(district));
  // URA stays on the nine urban districts even when every one is already used.
  const source = fresh.length ? fresh : pool;
  if (!source.length) throw new Error(`no districts for ${type}`);
  return source[Math.floor(rng.next() * source.length)];
}

function snapGfa(value) {
  return Math.round(value / 100) * 100;
}

export function emptyCredit() {
  return { unpaidStreak: 0, carried: 0, yellow: false, forceSmall: false, owed: 0, hadYellow: false };
}

export function campaignWorth(state) {
  const frozen = (state?.frozen || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return money((Number(state?.cash) || 0) + frozen);
}

export function tiersUnlocked(worth, balance) {
  const rows = balance.siteTiers || [{ id: "small", minWorth: 0, gfaMul: 1 }];
  const ok = rows.filter((row) => worth >= row.minWorth);
  return ok.length ? ok : [rows[0]];
}

export function rollSiteTier(worth, seed, completed, balance, forceSmall = false, weightDelta = null) {
  if (forceSmall || (completed || 0) < 2) return "small";
  const from = balance.flagshipFrom ?? 16;
  let unlocked = tiersUnlocked(worth, balance);
  if ((completed || 0) + 1 < from) unlocked = unlocked.filter((row) => row.id !== "flagship");
  if (!unlocked.length) unlocked = tiersUnlocked(worth, balance).filter((row) => row.id !== "flagship");
  if (!unlocked.length) unlocked = [tiersUnlocked(worth, balance)[0]];
  if (unlocked.length === 1) return unlocked[0].id;
  const weights = balance.siteTierWeights || { small: 3, mid: 4, large: 3, flagship: 2 };
  const rng = createRng((Number(seed) + (completed + 1) * 131 + Math.round(worth / 1000)) >>> 0);
  let total = 0;
  const bag = unlocked.map((row) => {
    const weight = Math.max(0, (weights[row.id] || 1) + (weightDelta?.[row.id] || 0));
    total += weight;
    return { id: row.id, weight };
  });
  if (total <= 0) return bag[0]?.id || "small";
  let cursor = rng.next() * total;
  for (const item of bag) {
    cursor -= item.weight;
    if (cursor <= 0) return item.id;
  }
  return bag[bag.length - 1].id;
}

function tierRow(balance, tier) {
  return (balance.siteTiers || []).find((row) => row.id === tier) || { id: "small", gfaMul: 1 };
}

export function scaleGfa(gfaFt2, tier, balance, forceSmall = false) {
  const mul = forceSmall ? balance.credit?.forcedMul || 0.7 : tierRow(balance, tier).gfaMul || 1;
  return snapGfa(Math.max(8000, gfaFt2 * mul));
}

export function contractorRisk(spec, balance = {}) {
  const leakMax = balance.riskScale?.leak || 0.4;
  const collapseMax = balance.riskScale?.collapse || 0.3;
  return {
    leak: clamp((Number(spec?.leak) || 0) / leakMax, 0, 1),
    collapse: clamp((Number(spec?.collapse) || 0) / collapseMax, 0, 1),
  };
}

export function quoteLoan(buildCost, mode, balance, adjust = null) {
  const use = LOAN_MODES.includes(mode) ? mode : "cash";
  const spec = balance.credit?.modes?.[use] || { principal: 0, rate: 0 };
  let principalFrac = Number(spec.principal) || 0;
  let rate = Number(spec.rate) || 0;
  if (adjust && use !== "cash") {
    principalFrac = clamp((principalFrac + (adjust.principalAdd || 0)) * (adjust.principalMul || 1), 0, 0.9);
    rate *= adjust.interestMul || 1;
  }
  const principal = money((Number(buildCost) || 0) * principalFrac);
  const interest = money(principal * rate);
  return { mode: use, principal, interest, rate, due: principal + interest };
}

function sameStake(value, target) {
  return Number.isFinite(value) && Math.abs(value - target) < 1e-9;
}

export function stakeOf(offer) {
  const stake = Number(offer?.stake);
  if (sameStake(stake, 1)) return 1;
  for (const share of JV_SHARES) {
    if (sameStake(stake, share)) return share;
  }
  return 1;
}

function parseStake(raw) {
  if (raw == null || raw === "full") return 1;
  const requested = Number(raw);
  if (sameStake(requested, 1)) return 1;
  for (const share of JV_SHARES) {
    if (sameStake(requested, share)) return share;
  }
  return null;
}

export function jvEligible(offer) {
  if (!offer) return false;
  const tier = offer.siteTier || "small";
  if (tier === "small") return false;
  return offer.verdict === "expensive" || tier === "mid" || tier === "large" || tier === "flagship";
}

export function activeEffects(state) {
  return (state?.effects || []).filter((effect) => (effect?.left || 0) > 0 || (effect?.offers || 0) > 0);
}

export function pushEffect(effects, effect) {
  const list = Array.isArray(effects) ? effects.slice() : [];
  if (!effect?.kind) return list;
  const live = list.some((item) => item.kind === effect.kind && ((item.left || 0) > 0 || (item.offers || 0) > 0));
  if (effect.loosen && live) return list;
  list.push({ ...effect });
  return list;
}

function ageEffects(effects) {
  return (effects || [])
    .map((effect) => ({ ...effect, left: Math.max(0, (effect.left || 0) - 1) }))
    .filter((effect) => (effect.left || 0) > 0 || (effect.offers || 0) > 0);
}

function consumeOfferEffects(effects) {
  return (effects || [])
    .map((effect) => (effect.offers > 0 ? { ...effect, offers: effect.offers - 1 } : effect))
    .filter((effect) => (effect.left || 0) > 0 || (effect.offers || 0) > 0);
}

export function policyNotes(state) {
  const notes = [];
  for (const effect of activeEffects(state)) {
    if (effect.note && !notes.includes(effect.note)) notes.push(effect.note);
  }
  return notes.slice(0, 2);
}

export function poolMultipliers(state) {
  const mul = { whale: 1, couple: 1, starter: 1, upgrader: 1, feature: 1 };
  for (const effect of activeEffects(state)) {
    if (!effect.poolMul) continue;
    for (const key of POOLS) {
      if (typeof effect.poolMul[key] === "number") mul[key] *= effect.poolMul[key];
    }
  }
  for (const key of POOLS) mul[key] = clamp(mul[key], 0.85, 1.15);
  return mul;
}

export function loanAdjustments(state) {
  const adjust = { principalAdd: 0, principalMul: 1, interestMul: 1 };
  for (const effect of activeEffects(state)) {
    if (effect.principalAdd) adjust.principalAdd += effect.principalAdd;
    if (effect.principalMul) adjust.principalMul *= effect.principalMul;
    if (effect.interestMul) adjust.interestMul *= effect.interestMul;
  }
  return adjust;
}

function tierDelta(state) {
  const delta = { small: 0, mid: 0, large: 0, flagship: 0 };
  for (const effect of activeEffects(state)) {
    if (!effect.tierDelta) continue;
    for (const key of Object.keys(delta)) delta[key] += Number(effect.tierDelta[key]) || 0;
  }
  return delta;
}

function typeWeights(state) {
  const weights = { ura: 1, mtr: 1, gov: 1 };
  for (const effect of activeEffects(state)) {
    if (typeof effect.mtrWeight === "number") weights.mtr *= effect.mtrWeight;
    if (typeof effect.uraWeight === "number") weights.ura *= effect.uraWeight;
  }
  return weights;
}

function premiumAdjust(state, type) {
  let delta = 0;
  for (const effect of activeEffects(state)) {
    if (typeof effect.premiumAll === "number") delta += effect.premiumAll;
    if (effect.premiumType && effect.premiumType === type && typeof effect.premiumTypeDelta === "number") {
      delta += effect.premiumTypeDelta;
    }
  }
  return clamp(delta, -0.06, 0.08);
}

function holdAdjust(state, balance) {
  let recover = Number(balance.holdRecover) || 0;
  let mul = 1;
  for (const effect of activeEffects(state)) {
    if (effect.holdRecoverAdd) recover += effect.holdRecoverAdd;
    if (effect.frozenMul) mul *= effect.frozenMul;
  }
  return { recover: clamp(recover, 0.4, 0.95), mul: clamp(mul, 0.7, 1.25) };
}

function mtrExtra(state) {
  let extra = 0;
  for (const effect of activeEffects(state)) {
    if (effect.mtrBoost) extra = Math.max(extra, effect.mtrBoost);
  }
  return extra;
}

function convertAdd(state) {
  let add = 0;
  for (const effect of activeEffects(state)) {
    if (effect.convertAdd) add = Math.max(add, effect.convertAdd);
  }
  return add;
}

function uraShareBump(state) {
  let add = 0;
  for (const effect of activeEffects(state)) {
    if (effect.uraShareAdd) add = Math.max(add, effect.uraShareAdd);
  }
  return add;
}

export function profitShareRate(type, skeleton, balance) {
  const spec = balance.landTypes?.[type] || {};
  const min = Number(spec.profitShareMin ?? 0);
  const max = Number(spec.profitShareMax ?? min);
  if (!(max > 0)) return 0;
  const key = `${type}|${skeleton?.slot || ""}|${skeleton?.district || ""}|${Math.round(skeleton?.gfaFt2 || 0)}|${skeleton?.premium || 0}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  const steps = Math.max(0, Math.round((max - min) * 100));
  const pct = Math.round(min * 100) + ((hash >>> 0) % (steps + 1));
  return pct / 100;
}

function stampShare(priced, state, balance) {
  let profitShare = priced.profitShare;
  if (priced.type === "ura") {
    profitShare = clamp(Math.round((profitShare + uraShareBump(state)) * 100) / 100, 0, 0.45);
  }
  const saved = arguments.length > 3 ? arguments[3] : null;
  if (typeof saved === "number") {
    const spec = balance?.landTypes?.[priced.type] || {};
    const min = Number(spec.profitShareMin ?? 0);
    const max = Number(spec.profitShareMax ?? min) + (priced.type === "ura" ? 0.05 : 0);
    if (saved + 1e-9 >= min && saved <= max + 1e-9) profitShare = saved;
  }
  return { ...priced, profitShare, partnerRate: profitShare };
}

export function splitProfit({ revenue, land, build, promo, rate, stake }) {
  const revenueN = money(revenue);
  const landN = money(land);
  const buildN = money(build);
  const promoN = money(promo);
  const share = clamp(Number(rate) || 0, 0, 0.6);
  const own = stakeOf({ stake: stake == null ? 1 : stake });
  const operating = money(revenueN - landN - buildN - promoN);
  const landCut = operating > 0 && share > 0 ? money(operating * share) : 0;
  const remainder = money(operating - landCut);
  const playerProfit = money(remainder * own);
  return {
    revenue: revenueN,
    land: landN,
    build: buildN,
    promo: promoN,
    operating,
    landCut,
    remainder,
    playerProfit,
    rate: share,
    stake: own,
  };
}

function fullBuildBill(contractor, stake) {
  if (!contractor) return 0;
  const share = stake > 0 && stake < 1 ? stake : 1;
  if (typeof contractor.grossCost === "number") {
    const extraPlayer = money(contractor.extra || 0);
    const extraFull = share < 1 ? money(extraPlayer / share) : extraPlayer;
    return money(contractor.grossCost + extraFull);
  }
  const bill = money(contractor.total || contractor.cost || 0);
  return share < 1 ? money(bill / share) : bill;
}

export function masterBlocks(units) {
  const n = Math.max(0, Math.round(Number(units) || 0));
  if (n >= 2000) return 4;
  if (n >= 80) return 3;
  return 2;
}

export function towerShares(units, sold) {
  const towers = masterBlocks(units);
  const n = Math.max(0, Math.round(Number(units) || 0));
  const soldN = Math.max(0, Math.min(n, Math.round(Number(sold) || 0)));
  const base = Math.floor(n / towers);
  let extra = n - base * towers;
  let soldLeft = soldN;
  const rows = [];
  for (let i = 0; i < towers; i += 1) {
    const count = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    const got = Math.min(count, soldLeft);
    soldLeft -= got;
    const pct = count ? Math.round((got / count) * 100) : 0;
    rows.push({ index: i, units: count, sold: got, pct });
  }
  return rows;
}

export function towerWord(pct) {
  const n = Math.round(Number(pct) || 0);
  if (n >= 100) return "clear";
  if (n >= 80) return "hot";
  if (n >= 50) return "steady";
  return "quiet";
}

export function fundBuild(balance, { cash, cost, mode, adjust = null }) {
  const quote = quoteLoan(cost, mode, balance, adjust);
  const have = Math.max(0, money(cash));
  const bill = Math.max(0, money(cost));
  let principal = quote.principal;
  if (quote.mode !== "cash") {
    const gap = Math.max(0, bill - have);
    if (principal < gap) principal = gap;
  }
  principal = money(principal);
  const interest = money(principal * (quote.rate || 0));
  const shortfall = money(Math.max(0, bill - (have + principal)));
  return {
    mode: quote.mode,
    principal,
    interest,
    rate: quote.rate,
    due: money(principal + interest),
    shortfall,
    ok: shortfall === 0,
    cashAfter: shortfall === 0 ? money(have + principal - bill) : have,
  };
}

export function remedyExtra(balance, grossCost, stake = 1, remedy = "rush") {
  const rates = remedyRates(balance, remedy === "worse" ? "worse" : "rush");
  const share = stakeOf({ stake });
  return money((Number(grossCost) || 0) * (Number(rates.extra) || 0) * share);
}

export function lapseExit(state) {
  const pending = Boolean(state?.project?.contractor?.collapsed && state?.project?.contractor?.remedyPending);
  return { screen: pending ? "remedy" : "sale", remedyPending: pending };
}

export function unitRowNote(parts) {
  return (parts || []).filter((part) => part != null && String(part) !== "").join(" · ");
}

function remedyRates(balance, remedy) {
  const table = balance.remedy || {};
  if (remedy === "worse") {
    return {
      extra: table.worseExtra,
      quality: table.worseQuality,
      leak: table.worseLeak,
      rep: table.worseRep,
      through: table.worseThrough,
    };
  }
  return {
    extra: balance.collapseExtra,
    quality: balance.collapseQuality,
    leak: balance.collapseLeakAdd,
    rep: balance.collapseRep,
    through: table.rushThrough ?? balance.collapseThrough,
  };
}

export function priceRemedy(balance, { cost, id, cashBefore, collapsed, remedy }) {
  const spec = balance.contractors[id];
  if (!spec) return null;
  let quality = spec.quality;
  let leak = spec.leak;
  let extra = 0;
  let rep = spec.rep;
  let saleDrag = 0;
  if (collapsed) {
    const rates = remedyRates(balance, remedy === "worse" ? "worse" : "rush");
    extra = money(cost * rates.extra);
    quality = round4(quality * rates.quality);
    leak = Math.min(0.95, round4(leak + rates.leak));
    rep += rates.rep;
    saleDrag = rates.through;
  }
  rep += -Math.round(leak * balance.leakRepWeight);
  const buildBill = cost + extra;
  let financeFee = 0;
  if (cashBefore < buildBill) {
    financeFee = money((buildBill - cashBefore) * balance.financeRate);
    rep += balance.overdraftRep;
  }
  return {
    quality,
    leak,
    extra,
    rep,
    saleDrag,
    financeFee,
    total: buildBill + financeFee,
    remedy: collapsed ? (remedy === "worse" ? "worse" : "rush") : null,
  };
}

export function settleCredit(cash, projectLoan, credit, balance) {
  const carried = Math.max(0, money(credit?.carried || 0));
  const interest = Math.max(0, money(projectLoan?.interest || 0));
  const principal = Math.max(0, money(projectLoan?.principal || 0));
  let left = Math.max(0, money(cash));
  const take = (amount) => {
    const pay = Math.min(left, Math.max(0, money(amount)));
    left = money(left - pay);
    return pay;
  };
  const paidCarried = take(carried);
  const paidInterest = take(interest);
  const paidPrincipal = take(principal);
  const fraction = balance.credit?.minPrincipalFraction ?? 0.25;
  const minPart = principal > 0 ? Math.max(1, money(principal * fraction)) : 0;
  const hadBill = carried + interest + principal > 0;
  const serviced = !hadBill || (paidInterest >= interest && paidPrincipal >= Math.min(principal, minPart));
  const forgiven = serviced ? money(principal - paidPrincipal) : 0;
  const unpaidPrincipal = serviced ? 0 : money(principal - paidPrincipal);
  const owed = money((carried - paidCarried) + (interest - paidInterest) + unpaidPrincipal);
  const borrowed = principal > 0;
  let streak = credit?.unpaidStreak || 0;
  const unpaid = borrowed && !serviced;
  if (unpaid) streak += 1;
  else if (serviced) streak = 0;
  const gameOver = unpaid && streak >= 2;
  const yellow = owed > 0;
  let nextCash = left;
  const floor = balance.credit?.survivalCash || 0;
  if (yellow && !gameOver && nextCash < floor) nextCash = floor;
  return {
    cash: nextCash,
    paidCarried,
    paidInterest,
    paidPrincipal,
    forgiven,
    owed,
    serviced,
    unpaid,
    yellow,
    forceSmall: yellow,
    unpaidStreak: gameOver ? streak : streak,
    gameOver,
  };
}

export function similarProject(state) {
  const offer = state?.project?.offer;
  if (!offer) return null;
  const heat = offer.heat;
  let flavourHit = null;
  let heatHit = null;
  const history = state.history || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    if (!item || item.skipped) continue;
    const flavour = Boolean(item.flavour && item.flavour === offer.flavour);
    const mood = Boolean(item.heat && item.heat === heat);
    if (flavour && mood) return item;
    if (flavour && !flavourHit) flavourHit = item;
    if (mood && !heatHit) heatHit = item;
  }
  return flavourHit || heatHit || null;
}

export function mixPoolGaps(catalog, state, mix) {
  const offer = state?.project?.offer;
  if (!offer) return [];
  const flavour = offer.flavour || districtFlavour(offer.district, catalog.balance);
  const heat = offer.heat || campaignHeat(state, catalog.balance);
  const pools = sizePools(catalog, {
    gfaFt2: offer.gfaFt2,
    flavour,
    heat,
    buyer: effectiveMarket(state.market).buyer || 1,
    bias: state.poolBias || emptyBias(),
  });
  const clean = normalizeMix(mix);
  return UNIT_SPECS.filter((spec) => clean[spec.id] > 0 && (pools[spec.pool] || 0) <= 0).map((spec) => ({
    unit: spec.id,
    pool: spec.pool,
    offered: clean[spec.id],
    poolSize: 0,
  }));
}

export function shouldTeachMismatch(state, gaps) {
  if (gaps && !Array.isArray(gaps) && typeof gaps === "object") {
    return Boolean(gaps.weak) && !state?.flags?.mismatchTaught;
  }
  return Array.isArray(gaps) && gaps.length > 0 && !state?.flags?.mismatchTaught;
}

export function mismatchEcho(project) {
  return Boolean(project && !project.skipped && project.mixWeak && project.sale?.outcome === "fail");
}

export function acknowledgeMismatch(state) {
  return succeed({ ...state, flags: { ...(state.flags || {}), mismatchTaught: true } });
}

export function saleBatches(units) {
  const n = Math.max(0, Math.round(Number(units) || 0));
  if (n < 400) return null;
  const blocks = n >= 8000 ? 8 : n >= 2000 ? 6 : 4;
  return { blocks, per: Math.ceil(n / blocks), label: "block" };
}

function lerp(min, max, t) {
  return min + (max - min) * t;
}

export function priceOffer(skeleton, levels, catalog, heat = "loose") {
  const bench = gameBench(catalog, skeleton.district, levels);
  const profitShare = profitShareRate(skeleton.type, skeleton, catalog.balance);
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
    partnerRate: profitShare,
    profitShare,
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

function rolledPremium(type, district, rng, balance, state, fixed) {
  if (fixed != null) return Math.round(fixed * 1000) / 1000;
  const spec = balance.landTypes[type];
  let min = spec.premiumMin;
  let max = spec.premiumMax;
  if (type === "gov" && spec.townPremiumMin != null) {
    const urban = (balance.urbanDistricts || []).includes(district);
    min = urban ? spec.urbanPremiumMin : spec.townPremiumMin;
    max = urban ? spec.urbanPremiumMax : spec.townPremiumMax;
  }
  const prem = lerp(min, max, rng.next()) + premiumAdjust(state, type);
  return Math.round(clamp(prem, 0.55, 1.6) * 1000) / 1000;
}

function makeOffer({ slot, type, district, gfaFt2, premium, rng, catalog, levels, used, heat, tier = "small", forceSmall = false, fixedGfa = false, state = null }) {
  const spec = catalog.balance.landTypes[type];
  const picked = district || pickDistrict(type, rng, catalog.balance, used);
  const rawBase = gfaFt2 || snapGfa(lerp(spec.gfaMin, spec.gfaMax, rng.next()));
  const base = state?.assets?.district ? snapGfa(rawBase * 1.08) : rawBase;
  const gfa = fixedGfa ? base : scaleGfa(base, tier, catalog.balance, forceSmall);
  const prem = rolledPremium(type, picked, rng, catalog.balance, state, premium);
  used?.add(picked);
  const priced = stampShare(priceOffer(
    {
      slot,
      type,
      district: picked,
      gfaFt2: gfa,
      premium: prem,
    },
    levels,
    catalog,
    heat,
  ), state, catalog.balance);
  return { ...priced, siteTier: forceSmall ? "small" : tier, forcedSmall: Boolean(forceSmall) };
}

function shuffle(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function tutorialOffers(rng, state, catalog, heat, tier, forceSmall) {
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
      tier,
      forceSmall,
      fixedGfa: true,
      state,
    }),
    makeOffer({ slot: "B", type: rest[0], rng, catalog, levels: state.market, used, heat, tier, forceSmall, state }),
    makeOffer({ slot: "C", type: rest[1], rng, catalog, levels: state.market, used, heat, tier, forceSmall, state }),
  ];
}

function pickWeighted(rng, weights) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  let cursor = rng.next() * total;
  for (const [type, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return type;
  }
  return entries[entries.length - 1][0];
}

function randomOffers(rng, state, catalog, heat, tier, forceSmall) {
  const weights = typeWeights(state);
  const skewed = Math.abs(weights.ura - weights.mtr) > 0.001 || Math.abs(weights.mtr - weights.gov) > 0.001;
  const types = skewed
    ? [pickWeighted(rng, weights), pickWeighted(rng, weights), pickWeighted(rng, weights)]
    : shuffle(["ura", "mtr", "gov"], rng);
  const used = new Set();
  return ["A", "B", "C"].map((slot, index) =>
    makeOffer({
      slot,
      type: types[index],
      rng,
      catalog,
      levels: state.market,
      used,
      heat,
      tier,
      forceSmall,
      state,
    }),
  );
}

function liftFlagshipOffer(offers, state, catalog, heat) {
  const from = catalog.balance.flagshipFrom ?? 16;
  if ((state.completed || 0) + 1 < from) return offers;
  if (state.credit?.forceSmall) return offers;
  const row = (catalog.balance.siteTiers || []).find((item) => item.id === "flagship");
  if (!row || campaignWorth(state) < row.minWorth) return offers;
  if (offers.some((offer) => offer.siteTier === "flagship")) return offers;
  const index = Math.max(0, offers.findIndex((offer) => offer.type === "gov"));
  const current = offers[index];
  const mul = tierRow(catalog.balance, current.siteTier || "small").gfaMul || 1;
  const raw = Math.max(64000, current.gfaFt2 / mul);
  const gfaFt2 = scaleGfa(raw, "flagship", catalog.balance, false);
  const priced = stampShare(priceOffer(
    {
      slot: current.slot,
      type: current.type,
      district: current.district,
      gfaFt2,
      premium: current.premium,
    },
    state.market,
    catalog,
    heat,
  ), state, catalog.balance);
  const next = offers.slice();
  next[index] = { ...priced, siteTier: "flagship", forcedSmall: false };
  return next;
}

export function offerBuyable(offer, cash) {
  if (!offer) return false;
  if (money(offer.landTotal) <= money(cash)) return true;
  const floor = Math.min(...JV_SHARES);
  return jvEligible(offer) && money(offer.landTotal * floor) <= money(cash);
}

function survivalCovered(offer, cash) {
  if (!offer) return false;
  if (money(offer.landTotal) <= money(cash)) return true;
  if (!jvEligible(offer)) return false;
  return JV_SHARES.some((share) => share > 0.25 && money(offer.landTotal * share) <= money(cash));
}

export function ensureAffordableOffer(offers, state, catalog, heat) {
  const cash = Math.max(0, money(state.cash || 0));
  if (offers.some((offer) => survivalCovered(offer, cash))) return offers;
  if (cash < 8000000) return offers;
  const budget = money(cash * 0.58);
  const premium = catalog.balance.landTypes.gov.premiumMin;
  let best = null;
  for (let gfaFt2 = 8000; gfaFt2 <= 28000; gfaFt2 += 200) {
    const priced = priceOffer(
      { slot: "B", type: "gov", district: "離島區", gfaFt2, premium },
      state.market,
      catalog,
      heat,
    );
    if (priced.landTotal <= budget) best = priced;
    else break;
  }
  if (!best || best.landTotal <= 0) return offers;
  const index = Math.max(0, offers.findIndex((offer) => offer.siteTier !== "flagship"));
  const next = offers.slice();
  next[index] = {
    ...best,
    slot: offers[index].slot,
    siteTier: "small",
    forcedSmall: Boolean(state.credit?.forceSmall),
  };
  return next;
}

export function rollOffers(state, catalog) {
  const heat = campaignHeat(state, catalog.balance);
  const forceSmall = Boolean(state.credit?.forceSmall);
  const tier = rollSiteTier(campaignWorth(state), state.seed, state.completed, catalog.balance, forceSmall, tierDelta(state));
  const { value, rngCursor } = runRng(state, (rng) => {
    if (state.completed === 0) return tutorialOffers(rng, state, catalog, heat, tier, forceSmall);
    return randomOffers(rng, state, catalog, heat, tier, forceSmall);
  });
  const lifted = liftFlagshipOffer(value, state, catalog, heat);
  const offers = ensureAffordableOffer(lifted, state, catalog, heat);
  return {
    ...state,
    rngCursor,
    offers,
    phase: "land",
    project: null,
    siteTier: tier,
    effects: consumeOfferEffects(state.effects),
  };
}

export function projectNumber(state) {
  if (state.phase === "summary") return state.completed;
  return state.completed + 1;
}

export function isTutorial(state) {
  return state.completed < 2 && state.phase !== "summary";
}

export function isOnboarding(state) {
  return Boolean(state && !state.onboarding?.completed && state.completed < 1);
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
    onboarding: { completed: false, step: "first-project" },
    phase: "land",
    market: initialMarket(),
    offers: null,
    project: null,
    story: null,
    history: [],
    flags: {},
    unitsSold: 0,
    unitsLaunched: 0,
    ownBuilds: 0,
    seed: seed >>> 0,
    rngCursor,
    poolBias: emptyBias(),
    frozen: [],
    voice: emptyVoice(),
    notice: null,
    credit: emptyCredit(),
    storyCounts: {},
    storyLog: [],
    effects: [],
    assets: emptyAssets(),
    seenAchievements: [],
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

export function chooseLand(catalog, state, slot, rawStake = 1) {
  if (state.phase !== "land") return fail(state, "bad_phase");
  const offer = (state.offers || []).find((item) => item.slot === slot);
  if (!offer) return fail(state, "bad_slot");
  const stake = parseStake(rawStake);
  if (stake == null) return fail(state, "bad_stake");
  if (stake < 1 && !jvEligible(offer)) return fail(state, "bad_stake");
  const landDiscount = state.assets?.landBank ? 0.12 : 0;
  const landPaid = money(offer.landTotal * stake * (1 - landDiscount));
  if (state.cash < landPaid) return fail(state, "insufficient_cash");
  const { value: move, rngCursor } = runRng(state, (rng) => drawMove(state, catalog, rng));
  const market = tickMarket(state.market, move, catalog.balance);
  return succeed({
    ...state,
    rngCursor,
    cash: money(state.cash - landPaid),
    market,
    offers: null,
    phase: "build",
    project: {
      index: state.completed + 1,
      skipped: false,
      name: defaultProjectName(offer.district, offer.flavour),
      offer: {
        ...offer,
        stake,
        landPaid,
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
  catalog = withOwnLevel(catalog, state);
  const spec = catalog.balance.contractors[contractorId];
  if (!spec || state.project?.offer == null) return null;
  const bench = gameBench(catalog, state.project.offer.district, state.market);
  const base = money(bench.fairBuildPerFt2 * state.project.offer.gfaFt2);
  const assembly = ASSEMBLY_OPTIONS[state.project.assembly || "standard"] || ASSEMBLY_OPTIONS.standard;
  const cost = money(base * spec.costMul * assembly.costMul);
  const stake = stakeOf(state.project.offer);
  const playerCost = money(cost * stake);
  return {
    id: contractorId,
    costMul: spec.costMul,
    leak: spec.leak,
    collapse: spec.collapse,
    quality: spec.quality,
    rep: spec.rep,
    buildPerFt2: money(bench.fairBuildPerFt2 * spec.costMul),
    cost,
    playerCost,
    financeFee: 0,
    total: playerCost,
    overdraft: false,
  };
}

export function rollCollapse(spec, roll) {
  return roll < spec.collapse;
}

export function chooseContractor(catalog, state, contractorId, rawMix, loanMode = "cash", assemblyId = "standard") {
  if (state.phase !== "build") return fail(state, "bad_phase");
  catalog = withOwnLevel(catalog, state);
  const spec = catalog.balance.contractors[contractorId];
  if (!spec) return fail(state, "bad_contractor");
  if (contractorId === "own" && !state.assets?.builder) return fail(state, "bad_contractor");
  const flavour = districtFlavour(state.project.offer.district, catalog.balance);
  const heat = campaignHeat(state, catalog.balance);
  const assembly = ASSEMBLY_OPTIONS[assemblyId] || ASSEMBLY_OPTIONS.standard;
  const expandedOffer = { ...state.project.offer, gfaFt2: snapGfa(state.project.offer.gfaFt2 * assembly.gfaMul) };
  const assembledState = { ...state, project: { ...state.project, offer: expandedOffer, assembly: assemblyId } };
  const mix = rawMix == null ? presetMix(expandedOffer.gfaFt2, flavour, heat, catalog.balance) : normalizeMix(rawMix);
  if (gfaUsed(mix) <= 0) return fail(state, "empty_mix");
  if (!mixFits(expandedOffer.gfaFt2, mix)) return fail(state, "over_gfa");
  const quote = contractorQuote(catalog, assembledState, contractorId);
  const stake = stakeOf(expandedOffer);
  const playerCost = quote.playerCost;
  const adjust = loanAdjustments(state);
  const plan = fundBuild(catalog.balance, { cash: state.cash, cost: playerCost, mode: loanMode, adjust });
  if (!plan.ok) {
    return fail(state, "short_cash", {
      shortfall: plan.shortfall,
      playerCost,
      loans: {
        small: fundBuild(catalog.balance, { cash: state.cash, cost: playerCost, mode: "small", adjust }),
        big: fundBuild(catalog.balance, { cash: state.cash, cost: playerCost, mode: "big", adjust }),
      },
    });
  }
  const loan = {
    mode: plan.mode,
    principal: plan.principal,
    interest: plan.interest,
    rate: plan.rate,
    due: plan.due,
  };
  const pricedMarket = effectiveMarket(state.market);
  const pricedAt = {
    price: pricedMarket.price,
    land: pricedMarket.land,
    build: pricedMarket.build,
    buyer: pricedMarket.buyer,
  };
  const { value, rngCursor } = runRng(state, (rng) => {
    const collapsed = rollCollapse(spec, rng.next());
    const move = drawMove(state, catalog, rng);
    const saleRoll = rng.next();
    return { collapsed, move, saleRoll };
  });
  const calm = priceRemedy(catalog.balance, {
    cost: quote.cost,
    id: contractorId,
    cashBefore: Number.MAX_SAFE_INTEGER,
    collapsed: false,
  });
  const rush = value.collapsed
    ? priceRemedy(catalog.balance, {
      cost: quote.cost,
      id: contractorId,
      cashBefore: Number.MAX_SAFE_INTEGER,
      collapsed: true,
      remedy: "rush",
    })
    : null;
  const bill = rush || calm;
  const extra = value.collapsed ? remedyExtra(catalog.balance, quote.cost, stake, "rush") : 0;
  const cashAfterQuote = plan.cashAfter;
  const payExtra = Math.min(cashAfterQuote, extra);
  const unpaid = money(extra - payExtra);
  const market = tickMarket(state.market, value.move, catalog.balance);
  const band = buildSalesBand(catalog, assembledState, mix, contractorId);
  return succeed({
    ...state,
    rngCursor,
    cash: money(cashAfterQuote - payExtra),
    reputation: clamp(state.reputation + bill.rep, 0, 100),
    market,
    phase: "sell",
    project: {
      ...state.project,
      offer: expandedOffer,
      assembly: assemblyId,
      loan,
      mixWeak: band.weak,
      contractor: {
        id: contractorId,
        collapsed: value.collapsed,
        quality: bill.quality,
        leak: bill.leak,
        cost: playerCost,
        grossCost: quote.cost,
        extra,
        financeFee: 0,
        total: playerCost + extra,
        playerCost,
        repDelta: bill.rep,
        overdraft: false,
        unpaid,
        pricedAt,
        cashBefore: state.cash + plan.principal,
        cashAfterQuote,
        remedy: bill.remedy,
        remedyPending: value.collapsed,
        saleDrag: bill.saleDrag,
      },
      mix,
      saleRoll: value.saleRoll,
      choices: null,
      sale: null,
    },
  });
}

export function chooseRemedy(catalog, state, choice) {
  if (state.phase !== "sell") return fail(state, "bad_phase");
  catalog = withOwnLevel(catalog, state);
  const contractor = state.project?.contractor;
  if (!contractor?.collapsed || !contractor.remedyPending) return fail(state, "bad_choice");
  if (choice !== "rush" && choice !== "worse") return fail(state, "bad_choice");
  const stake = stakeOf(state.project.offer);
  const gross = contractor.grossCost || contractor.cost;
  const bill = priceRemedy(catalog.balance, {
    cost: gross,
    id: contractor.id,
    cashBefore: Number.MAX_SAFE_INTEGER,
    collapsed: true,
    remedy: choice,
  });
  const extra = remedyExtra(catalog.balance, gross, stake, choice);
  const cashAfterQuote = typeof contractor.cashAfterQuote === "number" ? contractor.cashAfterQuote : state.cash;
  const pay = Math.min(Math.max(0, cashAfterQuote), extra);
  const unpaid = money(extra - pay);
  const repAdjust = bill.rep - (contractor.repDelta || 0);
  return succeed({
    ...state,
    cash: money(cashAfterQuote - pay),
    reputation: clamp(state.reputation + repAdjust, 0, 100),
    project: {
      ...state.project,
      contractor: {
        ...contractor,
        quality: bill.quality,
        leak: bill.leak,
        extra,
        financeFee: 0,
        total: (contractor.playerCost || contractor.cost) + extra,
        repDelta: bill.rep,
        overdraft: false,
        unpaid,
        remedy: choice,
        remedyPending: false,
        saleDrag: bill.saleDrag,
      },
    },
  });
}

const AD_TARGET_UNITS = {
  rent: ["studio"],
  couple: ["one"],
  starter: ["two"],
  upgrade: ["three"],
  feature: ["feature"],
};

const AD_MEDIA = ["online", "tv", "portal"];

function normalizeAdPlans(raw, balance) {
  const source = Array.isArray(raw.adPlans) ? raw.adPlans : [];
  const plans = source.map((plan) => ({
    medium: AD_MEDIA.includes(plan?.medium) ? plan.medium : "online",
    target: Object.prototype.hasOwnProperty.call(AD_TARGET_UNITS, plan?.target) ? plan.target : "starter",
    budget: plan?.budget === "high" ? "high" : "low",
    paidBudget: plan?.paidBudget === "high" ? "high" : plan?.paidBudget === "low" ? "low" : "none",
    active: plan?.active !== false,
  }));
  if (plans.length) return plans;
  if (raw.adBudget !== "none" && Object.prototype.hasOwnProperty.call(AD_TARGET_UNITS, raw.adTarget)) {
    return [{ medium: "online", target: raw.adTarget, budget: raw.adBudget, paidBudget: "none" }];
  }
  return [];
}

export function normalizeChoices(raw = {}, balance) {
  const cheer = clamp(Math.round(Number(raw.cheer) || 0), 0, balance.cheerMax);
  const showflat = Boolean(raw.showflat);
  const leftover = raw.leftover === "hold" ? "hold" : "cut";
  const price = raw.price === "cheap" || raw.price === "expensive" ? raw.price : "fair";
  const rebate = raw.rebate === "std" || raw.rebate === "high" ? raw.rebate : "none";
  const adBudget = raw.adBudget === "low" || raw.adBudget === "high" ? raw.adBudget : "none";
  const adTarget = Object.prototype.hasOwnProperty.call(AD_TARGET_UNITS, raw.adTarget) ? raw.adTarget : null;
  const baseMul = askMultiplier(price, balance);
  const askMulByType = {};
  for (const spec of UNIT_SPECS) {
    const value = Number(raw.askMulByType?.[spec.id]);
    askMulByType[spec.id] = Number.isFinite(value) && value > 0 ? clamp(value, 0.5, 1.8) : baseMul;
  }
  return {
    showflat,
    cheer,
    leftover,
    price,
    askMul: baseMul,
    askMulByType,
    rebate,
    adBudget,
    adTarget,
    adPlans: normalizeAdPlans(raw, balance),
    liveGain: clamp(Math.round(Number(raw.liveGain) || 0), -30, 30),
    liveSpend: Math.max(0, Math.round(Number(raw.liveSpend) || 0)),
  };
}

function promoSpec(choices, balance) {
  const table = balance.promo || {};
  const rebate = table.rebate?.[choices.rebate] || { through: 0, rate: 0 };
  const plans = choices.adPlans || [];
  const adThroughByUnit = {};
  let adPerFt2 = 0;
  let adPaidPerFt2 = 0;
  const adUnits = [];
  for (const plan of plans) {
    if (plan.active === false) continue;
    const aimed = AD_TARGET_UNITS[plan.target];
    const ad = table.ad?.[plan.budget] || { through: 0, perFt2: 0 };
    const paid = table.ad?.[plan.paidBudget] || { through: 0, perFt2: 0 };
    if (!aimed) continue;
    adPerFt2 += Number(ad.perFt2) || 0;
    adPaidPerFt2 += Number(paid.perFt2) || 0;
    for (const unit of aimed) {
      adThroughByUnit[unit] = (adThroughByUnit[unit] || 0) + (Number(ad.through) || 0);
      if (!adUnits.includes(unit)) adUnits.push(unit);
    }
  }
  return {
    rebateThrough: Number(rebate.through) || 0,
    rebateRate: Number(rebate.rate) || 0,
    adThrough: 0,
    adThroughByUnit,
    adPerFt2,
    adPaidPerFt2,
    adUnits,
  };
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
    poolMul: poolMultipliers(state),
  });
  const hold = holdAdjust(state, balance);
  const shareRate = typeof offer.profitShare === "number" ? clamp(offer.profitShare, 0, 0.6) : profitShareRate(offer.type, offer, balance);
  const usedRoll = typeof rawChoices?.roll === "number"
    ? rawChoices.roll
    : typeof roll === "number"
      ? roll
      : typeof state.project?.saleRoll === "number"
        ? state.project.saleRoll
        : 1;
  const askMul = choices.askMul;
  const promo = promoSpec(choices, balance);
  const twoAsk = fairPerFt2 * 450 * choices.askMulByType.two;
  const bowlRaw = affordability({
    lump: twoAsk,
    budget: balance.starterBudget * buyer,
    cheer: choices.cheer,
    gains: balance.cheerBowl,
  });
  const studioAsk = fairPerFt2 * 280 * choices.askMulByType.studio;
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
  let mulWeighted = 0;
  for (const spec of UNIT_SPECS) {
    const offered = mix[spec.id];
    units += offered;
    const typeMul = choices.askMulByType[spec.id];
    mulWeighted += offered * typeMul;
    const ask = fairPerFt2 * spec.ft2 * typeMul;
    let convert = balance.baseConvert[spec.id] + cheerBonus + choices.liveGain;
    if (choices.showflat) convert += balance.showflatBoost[spec.id];
    if (spec.id === "studio" && marketHeat === "loose") convert += balance.looseStudio;
    if (spec.id !== "studio" && marketHeat === "spicy") convert += balance.spicyLiveIn;
    convert += promo.rebateThrough;
    const aimed = promo.adUnits.includes(spec.id) && offered > 0;
    if (aimed) convert += promo.adThroughByUnit[spec.id] || 0;
    if (contractor.collapsed) {
      const drag = typeof contractor.saleDrag === "number" ? contractor.saleDrag : balance.collapseThrough;
      convert -= drag;
    }
    if (spec.id === "two" && !bowlRaw.ok) convert *= balance.bowlCrack;
    if (spec.id === "studio" && whaleSensitive) convert *= balance.whalePriceCut;
    convert *= priceConvert(typeMul, balance);
    if (offer.type === "mtr") {
      // Rail bonus: landTypes.mtr.sellBoost is +8 to +12 percentage points of through-rate.
      convert += Number(balance.landTypes?.mtr?.sellBoost) || 0;
      convert += mtrExtra(state);
    }
    if (offer.type === "ura" && (spec.id === "studio" || spec.id === "feature")) {
      convert -= Number(balance.landTypes?.ura?.mixRigid) || 0;
    }
    convert += convertAdd(state);
    convert = clamp(convert, 0.05, 0.98);
    const pool = poolsBefore[spec.pool];
    const brought = aimed ? Math.max(1, Math.round(offered * (promo.adThroughByUnit[spec.id] || 0))) : 0;
    let soldN = Math.min(offered, Math.round((pool + brought) * convert));
    if (spec.id === "studio" && cakeSweep > 0) soldN = Math.min(offered, Math.max(soldN, cakeSweep));
    const cap = aimed ? offered : Math.min(pool, offered);
    soldN = Math.max(0, Math.min(soldN, cap));
    const fromPool = Math.min(soldN, pool);
    const unsoldN = offered - soldN;
    poolsAfter[spec.pool] = pool - fromPool;
    grossExact += soldN * ask;
    if (unsoldN > 0 && choices.leftover === "cut") fireExact += unsoldN * ask * balance.fireSale;
    if (unsoldN > 0 && choices.leftover === "hold") frozenExact += unsoldN * ask * hold.recover * hold.mul;
    sold += soldN;
    byType[spec.id] = {
      offered,
      sold: soldN,
      unsold: unsoldN,
      ask: money(ask),
      convert: round4(convert),
      poolBefore: pool,
      poolAfter: pool - fromPool,
      brought,
      sensitive: spec.id === "studio" ? whaleSensitive : false,
    };
  }
  const gross = money(grossExact);
  const fireGross = money(fireExact);
  const frozenAmount = choices.leftover === "hold" ? money(frozenExact * stakeOf(offer)) : 0;
  const stake = stakeOf(offer);
  const showflatFull = choices.showflat ? money(balance.showflatPerFt2 * offer.gfaFt2) : 0;
  const rebateFull = money(gross * promo.rebateRate);
  const adFull = money(Math.max(0, promo.adPerFt2 - promo.adPaidPerFt2) * offer.gfaFt2);
  const showflatCost = money(showflatFull * stake);
  const rebateCost = money(rebateFull * stake);
  const adCost = money(adFull * stake);
  const paidAdCost = money(promo.adPaidPerFt2 * offer.gfaFt2 * stake);
  const books = splitProfit({
    revenue: gross + fireGross,
    land: offer.landTotal,
    build: fullBuildBill(contractor, stake),
    promo: showflatFull + rebateFull + adFull,
    rate: shareRate,
    stake,
  });
  const partnerShare = books.landCut;
  const fireNet = money(fireGross * stake);
  const playerRevenue = money((books.revenue - books.landCut) * stake);
  let netCash = money(playerRevenue - showflatCost - rebateCost - adCost);
  const landPaid = offer.landPaid != null ? offer.landPaid : money(offer.landTotal * stake);
  const profit = money(netCash - landPaid - (contractor.total || 0) - paidAdCost - (choices.liveSpend || 0));
  const unsold = units - sold;
  const ratio = units === 0 ? 0 : sold / units;
  let outcome = "fail";
  if (units > 0 && unsold === 0) outcome = "clear";
  else if (ratio >= balance.clearAt) outcome = "almost";
  else if (ratio >= balance.partialAt) outcome = "partial";
  const through = units === 0 ? 0 : sold / units;
  const heat = Math.round(clamp(through, 0, 1) * 100);
  let reputationDelta = outcome === "clear"
    ? balance.repClear
    : outcome === "almost"
      ? (balance.repAlmost ?? 1)
      : outcome === "partial"
        ? balance.repPartial
        : balance.repFail;
  const clearBonus = outcome === "clear" && profit > 0 ? money(profit * (balance.clearBonus ?? 0.02)) : 0;
  netCash = money(netCash + clearBonus);
  if (profit < 0) reputationDelta += balance.repLoss;
  if (unsold > 0 && choices.leftover === "cut") reputationDelta += balance.repCut;
  if (unsold > 0 && choices.leftover === "hold") reputationDelta += balance.repHold;
  const perUnit = units ? money(grossExact / Math.max(sold, 1)) : 0;
  const avgMul = units ? mulWeighted / units : askMul;
  choices.price = priceVerdict(avgMul, balance);
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
    rebateCost,
    adCost,
    paidAdCost,
    fairPerFt2: money(fairPerFt2),
    askPerFt2: money(fairPerFt2 * avgMul),
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
    partnerOnSales: partnerShare,
    profitShare: shareRate,
    revenue: books.revenue,
    landFull: books.land,
    buildFull: books.build,
    promoFull: books.promo,
    operating: books.operating,
    clearBonus,
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
  const bars = {};
  for (const spec of UNIT_SPECS) {
    const row = preview.byType[spec.id];
    if (row && row.unsold > stickyUnsold) {
      sticky = spec.id;
      stickyUnsold = row.unsold;
    }
    const offered = row?.offered || 0;
    const soldN = row?.sold || 0;
    bars[spec.id] = {
      offered,
      sold: soldN,
      unsold: row?.unsold || 0,
      pct: offered ? Math.round((soldN / offered) * 100) : 0,
    };
  }
  return {
    sellsOut: units > 0 && unsold === 0,
    left,
    leftRank: LEFT_RANK[left],
    sticky: unsold > 0 ? sticky : null,
    price: preview.choices.price,
    outcome: preview.outcome,
    pct: units ? Math.round((preview.sold / units) * 100) : 0,
    beforeCheer: true,
    bars,
  };
}

export function explainForecastGap(forecastPct, sale) {
  const actual = sale?.units ? Math.round((sale.sold / sale.units) * 100) : 0;
  const forecast = Math.round(Number(forecastPct) || 0);
  const gap = actual - forecast;
  if (Math.abs(gap) <= 4) return null;
  const reasons = [];
  if (gap > 0 && (sale?.choices?.cheer || 0) > 0) reasons.push("cheer");
  if (gap > 0 && (sale?.cakeSweep || 0) > 0) reasons.push("cake");
  if (gap < 0) reasons.push("low");
  if (!reasons.length) return null;
  return { actual, forecast, gap, reasons };
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
  if (pricey && view.unsoldRatio >= 0.25) return "dearEmpty";
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

export function commentForPhase(phase, project, voice) {
  if ((phase === "sell" || phase === "settle") && project && !project.skipped && project.sale) {
    return marketComment(commentSample(project));
  }
  return voiceComment(voice);
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
  if (state.project?.contractor?.remedyPending) return fail(state, "need_remedy");
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
  sale.forecastPct = saleForecast(catalog, state, normalized).pct;
  return succeed({
    ...state,
    rngCursor,
    phase: "settle",
    project: { ...state.project, choices: normalized, sale, saleRoll: roll },
  });
}

export function pickStory(stories, rng, { previousId = null, previousPulse = false, govLand = false, weight = 4, counts = {}, cap = 2 } = {}) {
  const blocked = (story) => story.id === previousId || (previousPulse && story.pulse);
  const underCap = stories.filter((story) => (counts[story.id] || 0) < cap && !blocked(story));
  const fresh = stories.filter((story) => !blocked(story));
  const pool = underCap.length ? underCap : fresh;
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
  const previousId = state.story?.id || state.storyLog?.[state.storyLog.length - 1] || null;
  const previous = STORIES.find((story) => story.id === previousId);
  const { value, rngCursor } = runRng(state, (rng) => pickStory(STORIES, rng, {
    previousId,
    previousPulse: Boolean(previous?.pulse),
    govLand,
    weight: govLand ? Number(catalog.balance.govControversyWeight ?? 1) : 1,
    counts: state.storyCounts || {},
    cap: catalog.balance.storyRepeatCap || 2,
  }));
  return {
    ...state,
    rngCursor,
    story: cloneStory(value),
    storyLog: [...(state.storyLog || []), value.id],
  };
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
      soldFt2: 0,
    };
  } else {
    const sale = state.project.sale;
    const soldFt2 = UNIT_SPECS.reduce((sum, spec) => sum + ((sale.byType?.[spec.id]?.sold || 0) * spec.ft2), 0);
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
      profitShare: sale.profitShare || 0,
      clearBonus: sale.clearBonus || 0,
      siteTier: state.project.offer.siteTier || "small",
      stake: stakeOf(state.project.offer),
      cakeSweep: sale.cakeSweep,
      name: state.project.name || defaultProjectName(state.project.offer.district, state.project.offer.flavour),
      mix: normalizeMix(state.project.mix),
      price: sale.choices?.price || "fair",
      leftover: sale.choices?.leftover || "cut",
      unsold: sale.unsold,
      reputationDelta: sale.reputationDelta,
      comment: marketComment(commentSample(state.project)),
      contractor: state.project.contractor?.id || null,
      collapsed: Boolean(state.project.contractor?.collapsed),
      quoteCost: state.project.contractor?.cost || 0,
      remedyCost: state.project.contractor?.total || 0,
      askPerFt2: sale.askPerFt2 || 0,
      forecastPct: sale.forecastPct ?? null,
      soldFt2,
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
  const loan = state.project?.skipped ? null : state.project?.loan || null;
  const bridge = state.project?.skipped ? 0 : money(state.project?.contractor?.unpaid || 0);
  const creditIn = {
    ...(state.credit || emptyCredit()),
    carried: money((state.credit?.carried || 0) + bridge),
  };
  const creditResult = settleCredit(cash, loan, creditIn, catalog.balance);
  if (!entry.skipped && loan) {
    entry.profit = money(entry.profit + (loan.principal || 0) - creditResult.paidPrincipal - creditResult.paidInterest);
    entry.loanMode = loan.mode;
    entry.bankPaid = money(creditResult.paidPrincipal + creditResult.paidInterest);
  }
  const history = [...state.history, entry];
  const credit = {
    unpaidStreak: creditResult.unpaidStreak,
    carried: creditResult.owed,
    yellow: creditResult.yellow,
    forceSmall: creditResult.forceSmall && !creditResult.gameOver && completed < catalog.balance.projects,
    owed: creditResult.owed,
    serviced: creditResult.serviced,
    forgiven: creditResult.forgiven,
    hadYellow: Boolean(state.credit?.hadYellow || creditResult.yellow),
  };
  const managedFt2 = (state.managedFt2 || 0) + (entry.soldFt2 || 0);
  const managementFee = state.assets?.manager ? money(managedFt2 * MANAGEMENT_FEE_PER_FT2_YEAR) : 0;
  const base = {
    ...state,
    onboarding: { completed: true, step: "done" },
    cash: money(creditResult.cash + assetIncome(state) + managementFee),
    reputation: clamp(reputation + (state.assets?.ai ? 1 : 0), 0, 100),
    unitsSold,
    unitsLaunched,
    managedFt2,
    ownBuilds: (state.ownBuilds || 0) + (entry.contractor === "own" && !entry.skipped ? 1 : 0),
    completed,
    history,
    voice,
    frozen: keep,
    offers: null,
    project: null,
    credit,
    effects: ageEffects(state.effects),
  };
  if (creditResult.gameOver) return succeed({ ...base, phase: "gameover", story: null });
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
  const storyCounts = { ...(state.storyCounts || {}) };
  if (state.story?.id) storyCounts[state.story.id] = (storyCounts[state.story.id] || 0) + 1;
  let effects = state.effects || [];
  const incoming = choice.effects || (choice.effect ? [choice.effect] : []);
  for (const effect of incoming) effects = pushEffect(effects, effect);
  const next = {
    ...state,
    flags,
    poolBias,
    storyCounts,
    effects,
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
    siteTier: offer.siteTier || "small",
    forcedSmall: Boolean(offer.forcedSmall),
    stake: stakeOf(offer),
    landPaid: offer.landPaid != null ? offer.landPaid : null,
    profitShare: typeof offer.profitShare === "number" ? offer.profitShare : null,
  };
}

function keptShare(offer, priced, balance) {
  const spec = balance.landTypes?.[offer?.type] || {};
  const min = Number(spec.profitShareMin ?? 0);
  const max = Number(spec.profitShareMax ?? min) + (offer?.type === "ura" ? 0.05 : 0);
  const saved = offer?.profitShare;
  if (typeof saved === "number" && saved + 1e-9 >= min && saved <= max + 1e-9) return saved;
  return priced.profitShare;
}

export function serializeCampaign(state) {
  return {
    v: SAVE_VERSION,
    company: state.company,
    cash: state.cash,
    reputation: state.reputation,
    completed: state.completed,
    onboarding: { completed: Boolean(state.onboarding?.completed), step: state.onboarding?.step || "first-project" },
    phase: state.phase,
    market: state.market,
    seed: state.seed,
    rngCursor: state.rngCursor,
    flags: state.flags,
    unitsSold: state.unitsSold,
    unitsLaunched: state.unitsLaunched,
    managedFt2: state.managedFt2 || 0,
    ownBuilds: state.ownBuilds || 0,
    poolBias: { ...emptyBias(), ...(state.poolBias || {}) },
    voice: { ...emptyVoice(), ...(state.voice || {}) },
    frozen: (state.frozen || []).map((item) => ({ ...item })),
    history: state.history.map((item) => ({ ...item })),
    credit: { ...emptyCredit(), ...(state.credit || {}) },
    storyCounts: { ...(state.storyCounts || {}) },
    storyLog: [...(state.storyLog || [])],
    story: state.story ? { id: state.story.id, picked: state.story.picked || null } : null,
    effects: (state.effects || []).map((effect) => ({ ...effect })),
    assets: { ...emptyAssets(), ...(state.assets || {}) },
    seenAchievements: [...(state.seenAchievements || [])],
    offers: (state.offers || []).map(slimOffer),
    project: state.project
      ? {
          index: state.project.index,
          skipped: Boolean(state.project.skipped),
          name: state.project.name || null,
          assembly: state.project.assembly || "standard",
          move: state.project.move ?? null,
          offer: slimOffer(state.project.offer),
          contractor: state.project.contractor
            ? {
                id: state.project.contractor.id,
                collapsed: Boolean(state.project.contractor.collapsed),
                pricedAt: state.project.contractor.pricedAt,
                cashBefore: state.project.contractor.cashBefore,
                remedy: state.project.contractor.remedy || null,
                remedyPending: Boolean(state.project.contractor.remedyPending),
                unpaid: money(state.project.contractor.unpaid || 0),
                cashAfterQuote: typeof state.project.contractor.cashAfterQuote === "number"
                  ? state.project.contractor.cashAfterQuote
                  : null,
              }
            : null,
          loan: state.project.loan ? { ...state.project.loan } : null,
          mixWeak: Boolean(state.project.mixWeak),
          mix: state.project.mix ? { ...state.project.mix } : null,
          choices: state.project.choices || null,
          saleRoll: typeof state.project.saleRoll === "number" ? state.project.saleRoll : null,
        }
      : null,
  };
}

function rehydrateContractor(saved, offer, catalog, ownBuilds = 0) {
  if (!saved?.id || !saved.pricedAt) return null;
  catalog = withOwnLevel(catalog, { ownBuilds });
  const spec = catalog.balance.contractors[saved.id];
  if (!spec) return null;
  const quote = contractorQuote(
    catalog,
    { cash: Number.MAX_SAFE_INTEGER, project: { offer }, market: saved.pricedAt },
    saved.id,
  );
  const stake = stakeOf(offer);
  const gross = quote.cost;
  const playerCost = money(gross * stake);
  const collapsed = Boolean(saved.collapsed);
  const pending = Boolean(saved.remedyPending);
  const remedy = pending ? "rush" : saved.remedy === "worse" ? "worse" : "rush";
  const bill = priceRemedy(catalog.balance, {
    cost: gross,
    id: saved.id,
    cashBefore: Number.MAX_SAFE_INTEGER,
    collapsed,
    remedy,
  });
  const extra = collapsed ? remedyExtra(catalog.balance, gross, stake, remedy) : 0;
  const cashBefore = typeof saved.cashBefore === "number" ? saved.cashBefore : playerCost;
  return {
    id: saved.id,
    collapsed,
    quality: bill.quality,
    leak: bill.leak,
    cost: playerCost,
    grossCost: gross,
    extra,
    financeFee: 0,
    total: playerCost + extra,
    playerCost,
    repDelta: bill.rep,
    overdraft: false,
    unpaid: money(saved.unpaid || 0),
    pricedAt: saved.pricedAt,
    cashBefore,
    cashAfterQuote: typeof saved.cashAfterQuote === "number" ? saved.cashAfterQuote : null,
    remedy: collapsed ? bill.remedy : null,
    remedyPending: pending,
    saleDrag: collapsed ? bill.saleDrag : 0,
  };
}

export function hydrateCampaign(catalog, saved) {
  if (!saved || saved.v !== SAVE_VERSION) throw new Error("unsupported save");
  if (!PHASES.includes(saved.phase)) throw new Error("unsupported save");
  const history = Array.isArray(saved.history) ? saved.history.map((item) => ({ ...item })) : [];
  // Saves written before management fees existed have no per-project area.
  // Estimate it from units sold so the portfolio total stays sensible.
  for (const item of history) {
    if (typeof item.soldFt2 !== "number") {
      item.soldFt2 = item.skipped ? 0 : (item.sold || 0) * 450;
    }
  }
  const historyFt2 = history.reduce((sum, item) => sum + (item.soldFt2 || 0), 0);
  const state = {
    v: SAVE_VERSION,
    company: normalizeCompany(saved.company),
    cash: money(saved.cash),
    reputation: clamp(saved.reputation, 0, 100),
    completed: clamp(saved.completed || 0, 0, catalog.balance.projects),
    onboarding: saved.onboarding
      ? { completed: Boolean(saved.onboarding.completed), step: saved.onboarding.step || "first-project" }
      : { completed: Number(saved.completed || 0) > 0, step: Number(saved.completed || 0) > 0 ? "done" : "first-project" },
    phase: saved.phase,
    market: hydrateMarket(saved.market, catalog.balance),
    seed: saved.seed >>> 0,
    rngCursor: saved.rngCursor >>> 0,
    flags: { ...(saved.flags || {}) },
    unitsSold: saved.unitsSold || 0,
    unitsLaunched: saved.unitsLaunched || 0,
    managedFt2: typeof saved.managedFt2 === "number" ? saved.managedFt2 : historyFt2,
    ownBuilds: Number.isFinite(saved.ownBuilds)
      ? Math.max(0, saved.ownBuilds)
      : history.filter((item) => item.contractor === "own" && !item.skipped).length,
    poolBias: { ...emptyBias(), ...(saved.poolBias || {}) },
    voice: {
      n: saved.voice?.n || 0,
      price: Number(saved.voice?.price) || 0,
      quality: typeof saved.voice?.quality === "number" ? saved.voice.quality : 1,
      stuck: Number(saved.voice?.stuck) || 0,
    },
    frozen: Array.isArray(saved.frozen) ? saved.frozen.map((item) => ({ ...item })) : [],
    history,
    credit: { ...emptyCredit(), ...(saved.credit || {}) },
    storyCounts: { ...(saved.storyCounts || {}) },
    storyLog: Array.isArray(saved.storyLog) ? [...saved.storyLog] : [],
    notice: null,
    offers: null,
    project: null,
    story: null,
    effects: Array.isArray(saved.effects) ? saved.effects.map((effect) => ({ ...effect })) : [],
    assets: { ...emptyAssets(), ...(saved.assets || {}) },
    seenAchievements: Array.isArray(saved.seenAchievements) ? [...saved.seenAchievements] : [],
  };
  const heat = campaignHeat(state, catalog.balance);
  const attachScale = (offer) => {
    const priced = priceOffer(offer, offer.quotedAt, catalog, heat);
    const stake = stakeOf(offer);
    const landPaid = typeof offer.landPaid === "number" ? money(offer.landPaid) : money(priced.landTotal * stake);
    const profitShare = keptShare(offer, priced, catalog.balance);
    return {
      ...priced,
      profitShare,
      partnerRate: profitShare,
      siteTier: offer.siteTier || "small",
      forcedSmall: Boolean(offer.forcedSmall),
      stake,
      landPaid,
    };
  };
  if (Array.isArray(saved.offers)) {
    state.offers = saved.offers.map(attachScale);
  }
  if (saved.project?.skipped) {
    state.project = { index: saved.project.index, skipped: true, move: saved.project.move };
  } else if (saved.project?.offer) {
    const offer = attachScale(saved.project.offer);
    const contractor = rehydrateContractor(saved.project.contractor, offer, catalog, state.ownBuilds);
    const loan = saved.project.loan && LOAN_MODES.includes(saved.project.loan.mode)
      ? {
          mode: saved.project.loan.mode,
          principal: money(saved.project.loan.principal || 0),
          interest: money(saved.project.loan.interest || 0),
          rate: Number(saved.project.loan.rate) || 0,
          due: money((saved.project.loan.principal || 0) + (saved.project.loan.interest || 0)),
        }
      : quoteLoan(0, "cash", catalog.balance);
    state.project = {
      index: saved.project.index,
      skipped: false,
      name: normalizeProjectName(saved.project.name, defaultProjectName(offer.district, offer.flavour)),
      assembly: ASSEMBLY_OPTIONS[saved.project.assembly] ? saved.project.assembly : "standard",
      offer,
      contractor,
      loan,
      mixWeak: Boolean(saved.project.mixWeak),
      mix: saved.project.mix ? normalizeMix(saved.project.mix) : null,
      choices: saved.project.choices || null,
      saleRoll: typeof saved.project.saleRoll === "number" ? saved.project.saleRoll : null,
      sale: null,
    };
    if (state.phase === "settle" && contractor) {
      const choices = saved.project.choices || {};
      state.project.sale = resolveSale(catalog, state, {
        ...choices,
        roll: state.project.saleRoll,
      });
      state.project.sale.forecastPct = saleForecast(catalog, state, choices).pct;
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
    v: 4,
    voice: raw.voice || emptyVoice(),
    history,
    project: raw.project ? { name: null, ...raw.project } : raw.project ?? null,
  };
}

function withMidterm(raw) {
  return {
    ...raw,
    v: 5,
    credit: { ...emptyCredit(), ...(raw.credit || {}) },
    storyCounts: raw.storyCounts && typeof raw.storyCounts === "object" ? { ...raw.storyCounts } : {},
    storyLog: Array.isArray(raw.storyLog) ? [...raw.storyLog] : [],
  };
}

function withVenture(raw) {
  const project = raw.project ? { ...raw.project } : raw.project ?? null;
  if (project?.offer && project.offer.stake == null) {
    project.offer = { ...project.offer, stake: 1 };
  }
  return { ...raw, v: 6, project };
}

function withIdentity(raw) {
  const company = { ...(raw.company || {}) };
  const chairName = String(company.chairName || "").trim().slice(0, 10);
  company.chairName = chairName || "主席";
  if (!CHAIR_AVATARS.includes(company.avatar)) company.avatar = CHAIR_AVATARS[0];
  let project = raw.project == null ? raw.project : { ...raw.project };
  if (project?.offer) {
    project = { ...project, offer: { ...project.offer, stake: stakeOf(project.offer) } };
  }
  return { ...raw, v: 7, company, project };
}

function withLedger(raw) {
  const strip = (offer) => {
    if (!offer) return offer;
    const next = { ...offer };
    delete next.partnerRate;
    if (typeof next.profitShare === "number") {
      const spec = { ura: [0.3, 0.45], mtr: [0.2, 0.3], gov: [0, 0] }[next.type] || [0, 0.45];
      if (next.profitShare < spec[0] - 1e-9 || next.profitShare > spec[1] + 1e-9) delete next.profitShare;
    }
    return next;
  };
  let project = raw.project == null ? raw.project : { ...raw.project };
  if (project?.offer) project = { ...project, offer: strip(project.offer) };
  const offers = Array.isArray(raw.offers) ? raw.offers.map(strip) : raw.offers;
  return {
    ...raw,
    v: SAVE_VERSION,
    offers,
    project,
    effects: Array.isArray(raw.effects) ? raw.effects : [],
    seenAchievements: Array.isArray(raw.seenAchievements) ? raw.seenAchievements : [],
  };
}

export function migrateSave(raw) {
  if (!raw) return { ok: false, notice: null, state: null };
  if (raw.goals || raw.v === 1 || raw.v === 2) return { ok: false, notice: "phase1_reset", state: null };
  if (raw.v === SAVE_VERSION) return { ok: true, notice: null, state: raw };
  if (raw.v === 7) return { ok: true, notice: null, state: withLedger(raw) };
  if (raw.v === 6) return { ok: true, notice: null, state: withLedger(withIdentity(raw)) };
  if (raw.v === 5) return { ok: true, notice: null, state: withLedger(withIdentity(withVenture(raw))) };
  if (raw.v === 4) return { ok: true, notice: null, state: withLedger(withIdentity(withVenture(withMidterm(raw)))) };
  if (raw.v === 3) return { ok: true, notice: null, state: withLedger(withIdentity(withVenture(withMidterm(upgradeV3(raw))))) };
  return { ok: false, notice: "phase1_reset", state: null };
}

export function settlementPreview(catalog, state) {
  if (!state?.project || state.project.skipped || state.phase !== "settle") {
    return {
      cash: state?.cash || 0,
      owed: state?.credit?.owed || 0,
      yellow: Boolean(state?.credit?.yellow),
      due: 0,
      paid: 0,
      gameOver: false,
    };
  }
  const sale = state.project.sale;
  let cash = money((state.cash || 0) + (sale?.netCash || 0));
  const completed = (state.completed || 0) + 1;
  let released = 0;
  for (const item of state.frozen || []) {
    if (item.releaseAt <= completed || completed >= catalog.balance.projects) released += item.amount || 0;
  }
  cash = money(cash + released);
  const loan = state.project.loan || null;
  const bridge = money(state.project.contractor?.unpaid || 0);
  const creditResult = settleCredit(cash, loan, {
    ...(state.credit || emptyCredit()),
    carried: money((state.credit?.carried || 0) + bridge),
  }, catalog.balance);
  const soldFt2 = state.assets?.manager
    ? UNIT_SPECS.reduce((sum, spec) => sum + ((sale?.byType?.[spec.id]?.sold || 0) * spec.ft2), 0)
    : 0;
  const managementFee = state.assets?.manager
    ? money(((state.managedFt2 || 0) + soldFt2) * MANAGEMENT_FEE_PER_FT2_YEAR)
    : 0;
  return {
    cash: money(creditResult.cash + managementFee),
    owed: creditResult.owed,
    yellow: Boolean(creditResult.yellow) && !creditResult.gameOver,
    due: loan?.due || 0,
    paid: money(creditResult.paidCarried + creditResult.paidInterest + creditResult.paidPrincipal),
    gameOver: creditResult.gameOver,
  };
}

export function buildSalesBand(catalog, state, mix, contractorId) {
  catalog = withOwnLevel(catalog, state);
  const clean = normalizeMix(mix);
  const id = contractorId && catalog.balance.contractors[contractorId] ? contractorId : "huimen";
  const spec = catalog.balance.contractors[id];
  const draft = {
    ...state,
    project: {
      ...state.project,
      mix: clean,
      contractor: {
        id,
        quality: spec.quality,
        leak: spec.leak,
        collapsed: false,
        total: 0,
        cost: 0,
        saleDrag: 0,
      },
    },
  };
  const sale = resolveSale(catalog, draft, {
    price: "fair",
    cheer: 0,
    leftover: "cut",
    rebate: "none",
    adBudget: "none",
    showflat: false,
    roll: 1,
  });
  const pct = sale.units ? Math.round((sale.sold / sale.units) * 100) : 0;
  const spread = catalog.balance.bandSpread ?? 8;
  const low = Math.max(0, pct - spread);
  const high = Math.min(99, Math.max(low, pct + spread));
  const gaps = mixPoolGaps(catalog, draft, clean);
  const weakAt = catalog.balance.weakBand ?? 22;
  return { low, high, pct, weak: gaps.length > 0 || high <= weakAt, gaps };
}

export function salesTone(pct) {
  const n = Number(pct) || 0;
  if (n >= 80) return "hot";
  if (n >= 50) return "steady";
  return "quiet";
}

export function bigLoanWarned(pct, mode) {
  return mode === "big" && salesTone(pct) !== "hot";
}

export function celebrateClear(outcome) {
  return outcome === "clear";
}

export function projectPresetMix(catalog, state) {
  const offer = state?.project?.offer;
  if (!offer) return emptyMix();
  const flavour = offer.flavour || districtFlavour(offer.district, catalog.balance);
  const heat = offer.heat === "spicy" || offer.heat === "loose" ? offer.heat : campaignHeat(state, catalog.balance);
  return presetMix(offer.gfaFt2, flavour, heat, catalog.balance);
}

export function updateCompany(state, input) {
  if (!state) return fail(state, "bad_phase");
  return succeed({ ...state, company: normalizeCompany({ ...(state.company || {}), ...(input || {}) }) });
}

export function buildOutlook(catalog, state, mix, contractorId, mode = "cash") {
  catalog = withOwnLevel(catalog, state);
  const offer = state?.project?.offer;
  if (!offer) return { interest: 0, profit: 0, tone: "quiet", warnBig: false };
  const stake = stakeOf(offer);
  const id = contractorId && catalog.balance.contractors[contractorId] ? contractorId : null;
  const spec = catalog.balance.contractors[id || "huimen"];
  const playerCost = id
    ? contractorQuote(catalog, state, id).playerCost
    : money((offer.estBuildTotal || 0) * stake);
  const plan = fundBuild(catalog.balance, { cash: state.cash, cost: playerCost, mode, adjust: loanAdjustments(state) });
  const draft = {
    ...state,
    project: {
      ...state.project,
      mix: normalizeMix(mix),
      contractor: {
        id: id || "huimen",
        quality: spec.quality,
        leak: spec.leak,
        collapsed: false,
        total: playerCost,
        cost: playerCost,
        saleDrag: 0,
      },
    },
  };
  const sale = resolveSale(catalog, draft, {
    price: "fair",
    cheer: 0,
    leftover: "cut",
    rebate: "none",
    adBudget: "none",
    showflat: false,
    roll: 1,
  });
  const band = buildSalesBand(catalog, state, mix, contractorId);
  const tone = salesTone(band.pct);
  return {
    interest: plan.interest,
    profit: sale.profit,
    tone,
    warnBig: mode === "big" && tone !== "hot",
    band,
  };
}

export function saleLedger(catalog, state, rawChoices) {
  const sale = resolveSale(catalog, state, rawChoices);
  const offer = state.project.offer;
  const stake = stakeOf(offer);
  const land = offer.landPaid != null ? offer.landPaid : money(offer.landTotal * stake);
  const build = state.project.contractor?.total || 0;
  const promo = (sale.rebateCost || 0) + (sale.adCost || 0) + (sale.showflatCost || 0);
  const outlay = land + build + promo;
  const multiple = outlay > 0 ? Math.round(((sale.netCash + promo) / outlay) * 100) / 100 : 0;
  return { build, promo, land, outlay, multiple, profit: sale.profit, netCash: sale.netCash, sale };
}

export function victoryFacts(state, balance) {
  const history = state?.history || [];
  const projects = balance?.projects ?? 30;
  return {
    clear: history.some((item) => item.outcome === "clear"),
    mega: history.some((item) => !item.skipped && (item.units || 0) >= 10000),
    flagship: history.some((item) => item.siteTier === "flagship"),
    comeback: Boolean(state?.credit?.hadYellow || state?.flags?.hadYellow),
    finished: state?.phase === "summary" && (state?.completed || 0) >= projects,
  };
}

export function victoryTitle(state, balance) {
  if (!state || state.phase === "gameover") return null;
  const facts = victoryFacts(state, balance);
  if (facts.mega && facts.clear) return "megaChair";
  if (facts.mega) return "mega";
  if (facts.comeback && facts.finished) return "comeback";
  if (facts.clear) return "clear";
  if (facts.flagship) return "flagship";
  if (facts.finished) return "chair";
  return null;
}

export function unlockedAchievements(state, balance) {
  if (!state || state.phase === "gameover") return [];
  const facts = victoryFacts(state, balance);
  const ids = [];
  if (facts.clear) ids.push("clear");
  if (facts.mega) ids.push("mega");
  if (facts.flagship) ids.push("flagship");
  const had = Boolean(state.credit?.hadYellow || state.flags?.hadYellow);
  const paid = had && !state.credit?.yellow && (state.completed || 0) > 0;
  if (had && (paid || facts.finished)) ids.push("comeback");
  if (facts.finished) ids.push("finished");
  return ids;
}

export function closingLine(state, balance) {
  const facts = victoryFacts(state, balance);
  const bits = [];
  if (facts.clear) bits.push("沽清");
  if (facts.mega) bits.push("萬伙");
  if (facts.flagship) bits.push("旗艦");
  if (facts.comeback) bits.push("黃牌翻身");
  if (!bits.length) return "三十盤做完。";
  return `呢屆有${bits.join("、")}。`;
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
