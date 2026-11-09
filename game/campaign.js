/**
 * Phase 2 campaign. No DOM.
 * One project = land → build → sell → settle. A run is 20 projects.
 * `game` money is the game economy. `openData` repeats RVD region $/m² and the
 * territory index only. District tiers are game levers, never official prices.
 */

import { DISTRICTS } from "./i18n.js";
import { STORIES } from "./stories.js";

export const SAVE_VERSION = 2;
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

export function priceOffer(skeleton, levels, catalog) {
  const bench = gameBench(catalog, skeleton.district, levels);
  const spec = catalog.balance.landTypes[skeleton.type];
  const partnerRate = spec.partnerRate;
  const landExact = bench.fairLandPerFt2 * skeleton.premium;
  const buildExact = bench.fairBuildPerFt2;
  return {
    slot: skeleton.slot,
    type: skeleton.type,
    district: skeleton.district,
    region: bench.region,
    gfaFt2: skeleton.gfaFt2,
    units: unitsFromGfa(skeleton.gfaFt2, catalog.balance),
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

function makeOffer({ slot, type, district, gfaFt2, premium, rng, catalog, levels, used }) {
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

function tutorialOffers(rng, state, catalog) {
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
    }),
    makeOffer({ slot: "B", type: rest[0], rng, catalog, levels: state.market, used }),
    makeOffer({ slot: "C", type: rest[1], rng, catalog, levels: state.market, used }),
  ];
}

function randomOffers(rng, state, catalog) {
  const types = shuffle(["ura", "mtr", "gov"], rng);
  const used = new Set();
  return ["A", "B", "C"].map((slot, index) =>
    makeOffer({ slot, type: types[index], rng, catalog, levels: state.market, used }),
  );
}

export function rollOffers(state, catalog) {
  const { value, rngCursor } = runRng(state, (rng) => {
    if (state.completed === 0) return tutorialOffers(rng, state, catalog);
    return randomOffers(rng, state, catalog);
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

export function chooseContractor(catalog, state, contractorId) {
  if (state.phase !== "build") return fail(state, "bad_phase");
  const spec = catalog.balance.contractors[contractorId];
  if (!spec) return fail(state, "bad_contractor");
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
    return { collapsed, move };
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
      choices: null,
      sale: null,
    },
  });
}

export function normalizeChoices(raw = {}, balance) {
  const ask = Object.prototype.hasOwnProperty.call(balance.ask, raw.ask) ? raw.ask : "market";
  const agents = Object.prototype.hasOwnProperty.call(balance.agents, raw.agents) ? raw.agents : "one";
  const ads = Object.prototype.hasOwnProperty.call(balance.ads, raw.ads) ? raw.ads : "web";
  const mix = Object.prototype.hasOwnProperty.call(balance.mixes, raw.mix) ? raw.mix : "blend";
  const rebate = Object.prototype.hasOwnProperty.call(balance.rebates, raw.rebate) ? raw.rebate : "std";
  const cheer = clamp(Math.round(Number(raw.cheer) || 0), 0, balance.cheerMax);
  return { ask, agents, ads, mix, rebate, cheer };
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

export function resolveSale(catalog, state, rawChoices) {
  const balance = catalog.balance;
  const choices = normalizeChoices(rawChoices, balance);
  const offer = state.project.offer;
  const contractor = state.project.contractor;
  const bench = gameBench(catalog, offer.district, state.market);
  const leakDrag = 1 - contractor.leak * balance.leakPriceDrag;
  const fairPerFt2 = bench.fairSalePerFt2 * contractor.quality * leakDrag;
  const unitFt2 = offer.gfaFt2 / offer.units;
  const fairPerUnit = fairPerFt2 * unitFt2;
  const askMul = balance.ask[choices.ask];
  const askPerUnit = fairPerUnit * askMul;
  const agent = balance.agents[choices.agents];
  const ads = balance.ads[choices.ads];
  const mix = balance.mixes[choices.mix];
  const rebate = balance.rebates[choices.rebate];
  let cheerBonus = 0;
  for (let i = 0; i < choices.cheer; i += 1) cheerBonus += balance.cheerGains[i];
  const channel = choices.mix === "retail" ? balance.retailChannel : choices.mix === "whale" ? 0.65 : 1;
  let through = baseThrough(askMul, balance);
  through += agent.through * channel + ads.through * channel + rebate.through + cheerBonus + mix.through;
  if (choices.mix === "whale" && askMul >= balance.whaleWalkAt) through += balance.whaleWalk;
  through -= contractor.leak * balance.leakThroughDrag;
  if (contractor.collapsed) through -= balance.collapseThrough;
  through += ((state.reputation - 50) / 50) * balance.repThrough;
  through = clamp(through, 0.04, 1);
  let sold = Math.round(offer.units * through);
  if (through >= balance.clearAt) sold = offer.units;
  sold = clamp(sold, 0, offer.units);
  const unsold = offer.units - sold;
  const ratio = offer.units === 0 ? 0 : sold / offer.units;
  let outcome = "fail";
  if (sold === offer.units || ratio >= balance.clearAt) outcome = "clear";
  else if (ratio >= balance.partialAt) outcome = "partial";
  const gross = money(sold * askPerUnit);
  const afterRebate = money(gross * (1 - rebate.rate));
  const rebateCost = gross - afterRebate;
  const agentFee = money(afterRebate * agent.rate);
  const adCost = money(ads.flatPerFt2 * offer.gfaFt2);
  const partnerShare = money(afterRebate * offer.partnerRate);
  const fireGross = money(unsold * fairPerUnit * balance.fireSale);
  const firePartner = money(fireGross * offer.partnerRate);
  const fireNet = fireGross - firePartner;
  const netCash = afterRebate - agentFee - adCost - partnerShare + fireNet;
  const profit = netCash - offer.landTotal - contractor.total;
  const heat = Math.round(clamp(through, 0, 1) * 100);
  let reputationDelta = outcome === "clear" ? balance.repClear : outcome === "partial" ? balance.repPartial : balance.repFail;
  if (profit < 0) reputationDelta += balance.repLoss;
  return {
    choices,
    askMul,
    askPerUnit: money(askPerUnit),
    fairPerUnit: money(fairPerUnit),
    fairPerFt2: money(fairPerFt2),
    askPerFt2: money(askPerUnit / unitFt2),
    through,
    sold,
    unsold,
    units: offer.units,
    outcome,
    heat,
    gross,
    afterRebate,
    rebateCost,
    agentFee,
    adCost,
    partnerShare: partnerShare + firePartner,
    partnerOnSales: partnerShare,
    fireNet,
    netCash,
    profit,
    reputationDelta,
    risk: priceRisk(askMul),
  };
}

export function commitSale(catalog, state, choices) {
  if (state.phase !== "sell") return fail(state, "bad_phase");
  const normalized = normalizeChoices(choices, catalog.balance);
  const sale = resolveSale(catalog, state, normalized);
  return succeed({
    ...state,
    phase: "settle",
    project: { ...state.project, choices: normalized, sale },
  });
}

function takeStory(state) {
  const { value, rngCursor } = runRng(state, (rng) => {
    const previous = state.story?.id;
    const pool = STORIES.filter((story) => story.id !== previous);
    return pool[Math.floor(rng.next() * pool.length)];
  });
  return {
    ...state,
    rngCursor,
    story: { id: value.id, tc: value.tc, en: value.en, choices: value.choices.map((choice) => ({ ...choice })) },
  };
}

export function confirmSettle(catalog, state) {
  if (state.phase !== "settle") return fail(state, "bad_phase");
  let cash = state.cash;
  let reputation = state.reputation;
  let unitsSold = state.unitsSold;
  let unitsLaunched = state.unitsLaunched;
  let entry;
  if (state.project?.skipped) {
    entry = {
      index: state.completed + 1,
      skipped: true,
      district: null,
      type: null,
      outcome: "skip",
      profit: 0,
      sold: 0,
      units: 0,
      partnerShare: 0,
    };
  } else {
    const sale = state.project.sale;
    cash = money(cash + sale.netCash);
    reputation = clamp(reputation + sale.reputationDelta, 0, 100);
    unitsSold += sale.sold;
    unitsLaunched += sale.units;
    entry = {
      index: state.completed + 1,
      skipped: false,
      district: state.project.offer.district,
      type: state.project.offer.type,
      outcome: sale.outcome,
      profit: sale.profit,
      sold: sale.sold,
      units: sale.units,
      partnerShare: sale.partnerShare,
    };
  }
  const completed = state.completed + 1;
  const history = [...state.history, entry];
  const base = {
    ...state,
    cash,
    reputation,
    unitsSold,
    unitsLaunched,
    completed,
    history,
    offers: null,
    project: null,
  };
  if (completed >= catalog.balance.projects) {
    return succeed({ ...base, phase: "summary", story: null });
  }
  return succeed({ ...takeStory(base), phase: "story" });
}

export function chooseStory(catalog, state, choiceId) {
  if (state.phase !== "story") return fail(state, "bad_phase");
  const choice = (state.story?.choices || []).find((item) => item.id === choiceId);
  if (!choice) return fail(state, "bad_choice");
  const flags = { ...state.flags };
  if (choice.flag) flags[choice.flag] = true;
  const next = {
    ...state,
    flags,
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
    history: state.history.map((item) => ({ ...item })),
    story: state.story ? { id: state.story.id, picked: state.story.picked || null } : null,
    offers: (state.offers || []).map(slimOffer),
    project: state.project
      ? {
          index: state.project.index,
          skipped: Boolean(state.project.skipped),
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
          choices: state.project.choices || null,
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
    history: Array.isArray(saved.history) ? saved.history.map((item) => ({ ...item })) : [],
    notice: null,
    offers: null,
    project: null,
    story: null,
  };
  if (Array.isArray(saved.offers)) {
    state.offers = saved.offers.map((offer) => priceOffer(offer, offer.quotedAt, catalog));
  }
  if (saved.project?.skipped) {
    state.project = { index: saved.project.index, skipped: true, move: saved.project.move };
  } else if (saved.project?.offer) {
    const offer = priceOffer(saved.project.offer, saved.project.offer.quotedAt, catalog);
    const contractor = rehydrateContractor(saved.project.contractor, offer, catalog);
    state.project = {
      index: saved.project.index,
      skipped: false,
      offer,
      contractor,
      choices: saved.project.choices || null,
      sale: null,
    };
    if (state.phase === "settle" && contractor) {
      state.project.sale = resolveSale(catalog, state, saved.project.choices || {});
    }
  }
  if (saved.story?.id) {
    const found = STORIES.find((story) => story.id === saved.story.id) || STORIES[0];
    state.story = {
      id: found.id,
      tc: found.tc,
      en: found.en,
      choices: found.choices.map((choice) => ({ ...choice })),
      picked: saved.story.picked || null,
    };
  }
  return state;
}

export function migrateSave(raw) {
  if (!raw) return { ok: false, notice: null, state: null };
  if (raw.v === SAVE_VERSION && !raw.goals) return { ok: true, notice: null, state: raw };
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
