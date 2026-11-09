/**
 * HK Dev Tycoon economy. No DOM. State is { cash, parcels, tick, goals }.
 * Money in `quote().game` is game economy. `quote().openData` repeats published
 * RVD region $/m² and the territory index only — never an 18-district price.
 */

const REGIONS = ["港島", "九龍", "新界"];

export function money(value) {
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cloneState(state) {
  return {
    cash: state.cash,
    tick: state.tick,
    parcels: state.parcels.map((parcel) => ({ ...parcel })),
    goals: {
      ...state.goals,
      steps: { ...state.goals.steps },
    },
    report: state.report ? { ...state.report } : null,
  };
}

function fail(state, error) {
  return { ok: false, error, state };
}

function succeed(state) {
  return { ok: true, error: null, state };
}

export function createCatalog({ parcels, market, balance }) {
  const list = Array.isArray(parcels) ? parcels : parcels.parcels;
  if (!Array.isArray(list) || list.length < 300) {
    throw new Error("parcels catalog is missing the aggregated map");
  }
  const priceAreas = Object.keys(market?.prices?.averagePrices?.areas ?? {});
  const extra = priceAreas.filter((key) => !REGIONS.includes(key));
  if (extra.length > 0) {
    throw new Error(`refusing district official prices: ${extra.join(",")}`);
  }
  for (const region of REGIONS) {
    const cell = market.prices.averagePrices.areas[region]?.[balance.calibrationClass];
    if (!cell || typeof cell.value !== "number") {
      throw new Error(`missing open-data ${region} class ${balance.calibrationClass} price`);
    }
  }
  if (!Array.isArray(balance.indexDrift) || balance.indexDrift.length !== balance.quarters) {
    throw new Error("indexDrift must contain one game-economy move per quarter");
  }
  const byId = new Map(list.map((parcel) => [parcel.id, parcel]));
  return { parcels: list, market, balance, byId };
}

function blankGoals(mode, balance) {
  return {
    mode,
    maxTicks: balance.quarters,
    district: mode === "tutorial" ? balance.tutorial.district : null,
    targetNetWorth: mode === "free" ? balance.freePlay.targetNetWorth : null,
    steps: { buy: false, build: false, rent: false, collect: false },
    won: false,
    bankrupt: false,
    finished: false,
    endReason: null,
  };
}

export function createGame(catalog, { mode } = {}) {
  if (mode !== "tutorial" && mode !== "free") {
    throw new Error("mode must be tutorial or free");
  }
  const startingCash =
    mode === "tutorial" ? catalog.balance.tutorial.startingCash : catalog.balance.freePlay.startingCash;
  return {
    cash: startingCash,
    parcels: [],
    tick: 0,
    goals: blankGoals(mode, catalog.balance),
    report: null,
  };
}

export function unitCount(buildings, balance) {
  const raw = balance.unitBase * Math.sqrt(buildings);
  return clamp(Math.round(raw), balance.minUnits, balance.maxUnits);
}

export function indexMultiplier(balance, tick) {
  let multiplier = 1;
  const steps = Math.min(Math.max(tick, 0), balance.indexDrift.length);
  for (let i = 0; i < steps; i += 1) multiplier *= 1 + balance.indexDrift[i];
  return multiplier;
}

export function gameIndex(catalog, tick) {
  const series = catalog.market.prices.priceIndex;
  const openDataBase = series.series.all.value;
  const multiplier = indexMultiplier(catalog.balance, tick);
  return {
    openDataBase,
    month: series.month,
    base: series.base,
    provisional: series.provisional,
    multiplier,
    gameLevel: Math.round(openDataBase * multiplier * 10) / 10,
  };
}

export function marketPath(catalog) {
  const points = [];
  for (let tick = 0; tick <= catalog.balance.quarters; tick += 1) {
    points.push({ tick, ...gameIndex(catalog, tick) });
  }
  return points;
}

function supplyFactor(market, district, balance) {
  const row = market.areas[district];
  if (!row) throw new Error(`missing open-data counts for ${district}`);
  const vacancy = (row.vacancyPct || 0) / 100;
  const share = row.completionsSharePct == null ? 0 : row.completionsSharePct / 100;
  const factor = 1 - balance.vacancyPriceDrag * vacancy - balance.completionShock * share;
  return clamp(factor, balance.minSupplyFactor, 1.05);
}

function ageFactor(medianYear, vintageYear, balance) {
  const age = vintageYear - medianYear;
  if (age <= balance.newAgeYears) return 1 + balance.ageNewPremium;
  if (age >= balance.oldAgeYears) return 1 - balance.ageOldDiscount;
  return 1;
}

export function quote(catalog, state, parcel) {
  const { market, balance } = catalog;
  const klass = balance.calibrationClass;
  const regionCell = market.prices.averagePrices.areas[parcel.region]?.[klass];
  if (!regionCell || typeof regionCell.value !== "number") {
    throw new Error(`no open-data region price for ${parcel.region}`);
  }
  const vintageYear = market.prices.averagePrices.year;
  const units = unitCount(parcel.buildings, balance);
  const areaM2 = units * balance.areaPerUnitM2;
  const multiplier = indexMultiplier(balance, state.tick);
  const supply = supplyFactor(market, parcel.district, balance);
  const age = ageFactor(parcel.medianYear, vintageYear, balance);
  const gamePerM2 = regionCell.value * multiplier * supply * age;
  const saleable = money(gamePerM2 * areaM2);
  const counts = market.areas[parcel.district];
  const vacancy = (counts.vacancyPct || 0) / 100;
  const occupancy = clamp(1 - vacancy * balance.vacancyRentDrag, 0, 1);
  const landPrice = money(saleable * balance.landCostShare);
  const buildCost = money(saleable * balance.buildCostShare);
  return {
    openData: {
      region: parcel.region,
      classId: klass,
      hkdPerM2: regionCell.value,
      provisional: Boolean(regionCell.provisional),
      fewTransactions: Boolean(regionCell.fewTransactions),
      month: market.prices.averagePrices.month,
      unit: market.prices.averagePrices.unit,
      territoryIndex: market.prices.priceIndex.series.all.value,
      indexMonth: market.prices.priceIndex.month,
      indexBase: market.prices.priceIndex.base,
      vacancyPct: counts.vacancyPct,
      completions: counts.completions,
      stock: counts.stock,
      district: parcel.district,
    },
    game: {
      units,
      areaM2,
      multiplier,
      supplyFactor: supply,
      ageFactor: age,
      gamePerM2: money(gamePerM2),
      saleable,
      landPrice,
      buildCost,
      rentPerQuarter: money(saleable * balance.rentYieldPerQuarter * occupancy),
      holdingPerQuarter: money(saleable * balance.holdingCostPerQuarter),
      landHoldingPerQuarter: money(landPrice * balance.landHoldingPerQuarter),
      sellProceeds: money(saleable * (1 - balance.sellFriction)),
      sellLandProceeds: money(landPrice * (1 - balance.sellFriction)),
    },
  };
}

export function netWorth(catalog, state) {
  let assets = 0;
  for (const owned of state.parcels) {
    const priced = quote(catalog, state, owned);
    assets += owned.status === "built" ? priced.game.sellProceeds : priced.game.sellLandProceeds;
  }
  return money(state.cash + assets);
}

function refreshWin(catalog, state) {
  if (state.goals.mode === "tutorial") {
    const steps = state.goals.steps;
    state.goals.won = Boolean(steps.buy && steps.build && steps.rent && steps.collect);
    return;
  }
  state.goals.won = netWorth(catalog, state) >= state.goals.targetNetWorth;
}

function ownedCopy(parcel, tick) {
  return {
    id: parcel.id,
    district: parcel.district,
    region: parcel.region,
    lat: parcel.lat,
    lng: parcel.lng,
    buildings: parcel.buildings,
    medianYear: parcel.medianYear,
    sampleAddress: parcel.sampleAddress,
    status: "land",
    use: null,
    boughtAt: tick,
    builtAt: null,
  };
}

function requirePlayable(state) {
  if (state.goals.finished) return "finished";
  return null;
}

export function buy(catalog, state, parcelId) {
  const blocked = requirePlayable(state);
  if (blocked) return fail(state, blocked);
  const parcel = catalog.byId.get(parcelId);
  if (!parcel) return fail(state, "unknown_parcel");
  if (state.parcels.some((owned) => owned.id === parcelId)) return fail(state, "not_for_sale");
  if (state.goals.mode === "tutorial" && parcel.district !== catalog.balance.tutorial.district) {
    return fail(state, "tutorial_sha_tin_only");
  }
  const priced = quote(catalog, state, parcel);
  if (state.cash < priced.game.landPrice) return fail(state, "insufficient_cash");
  const next = cloneState(state);
  next.cash = money(next.cash - priced.game.landPrice);
  next.parcels = [...next.parcels, ownedCopy(parcel, state.tick)];
  if (state.goals.mode === "tutorial") next.goals.steps.buy = true;
  refreshWin(catalog, next);
  return succeed(next);
}

export function build(catalog, state, parcelId) {
  const blocked = requirePlayable(state);
  if (blocked) return fail(state, blocked);
  const parcel = state.parcels.find((owned) => owned.id === parcelId);
  if (!parcel) return fail(state, "not_owned");
  if (parcel.status !== "land") return fail(state, "not_land");
  const priced = quote(catalog, state, parcel);
  if (state.cash < priced.game.buildCost) return fail(state, "insufficient_cash");
  const next = cloneState(state);
  next.cash = money(next.cash - priced.game.buildCost);
  next.parcels = next.parcels.map((owned) =>
    owned.id === parcelId
      ? { ...owned, status: "built", use: "hold", builtAt: state.tick }
      : owned,
  );
  if (state.goals.mode === "tutorial") next.goals.steps.build = true;
  refreshWin(catalog, next);
  return succeed(next);
}

function setUse(catalog, state, parcelId, use) {
  const blocked = requirePlayable(state);
  if (blocked) return fail(state, blocked);
  const parcel = state.parcels.find((owned) => owned.id === parcelId);
  if (!parcel) return fail(state, "not_owned");
  if (parcel.status !== "built") return fail(state, "not_built");
  const next = cloneState(state);
  next.parcels = next.parcels.map((owned) => (owned.id === parcelId ? { ...owned, use } : owned));
  if (use === "rent" && state.goals.mode === "tutorial") next.goals.steps.rent = true;
  refreshWin(catalog, next);
  return succeed(next);
}

export function hold(catalog, state, parcelId) {
  return setUse(catalog, state, parcelId, "hold");
}

export function rent(catalog, state, parcelId) {
  return setUse(catalog, state, parcelId, "rent");
}

export function sell(catalog, state, parcelId) {
  const blocked = requirePlayable(state);
  if (blocked) return fail(state, blocked);
  const parcel = state.parcels.find((owned) => owned.id === parcelId);
  if (!parcel) return fail(state, "not_owned");
  const priced = quote(catalog, state, parcel);
  const proceeds = parcel.status === "built" ? priced.game.sellProceeds : priced.game.sellLandProceeds;
  const next = cloneState(state);
  next.cash = money(next.cash + proceeds);
  next.parcels = next.parcels.filter((owned) => owned.id !== parcelId);
  refreshWin(catalog, next);
  return succeed(next);
}

export function tick(catalog, state) {
  const blocked = requirePlayable(state);
  if (blocked) return fail(state, blocked);
  if (state.tick >= catalog.balance.quarters) return fail(state, "finished");
  const next = cloneState(state);
  next.tick += 1;
  let rentIncome = 0;
  let holdingCost = 0;
  for (const parcel of next.parcels) {
    const priced = quote(catalog, next, parcel);
    if (parcel.status === "built") {
      if (parcel.use === "rent") rentIncome += priced.game.rentPerQuarter;
      holdingCost += priced.game.holdingPerQuarter;
    } else {
      holdingCost += priced.game.landHoldingPerQuarter;
    }
  }
  next.cash = money(next.cash + rentIncome - holdingCost);
  next.report = {
    tick: next.tick,
    rentIncome,
    holdingCost,
    net: rentIncome - holdingCost,
  };
  if (rentIncome > 0 && next.goals.mode === "tutorial") next.goals.steps.collect = true;
  if (next.cash < 0) {
    next.goals.bankrupt = true;
    next.goals.finished = true;
    next.goals.endReason = "bankrupt";
  } else if (next.tick >= catalog.balance.quarters) {
    next.goals.finished = true;
    next.goals.endReason = "quarters";
  }
  refreshWin(catalog, next);
  return succeed(next);
}

export function serialize(state) {
  return {
    v: 1,
    cash: state.cash,
    tick: state.tick,
    goals: {
      ...state.goals,
      steps: { ...state.goals.steps },
    },
    report: state.report ? { ...state.report } : null,
    parcels: state.parcels.map((parcel) => ({
      id: parcel.id,
      status: parcel.status,
      use: parcel.use,
      boughtAt: parcel.boughtAt,
      builtAt: parcel.builtAt,
    })),
  };
}

export function hydrate(catalog, saved) {
  if (!saved || saved.v !== 1) throw new Error("unsupported save");
  const parcels = [];
  for (const row of saved.parcels ?? []) {
    const base = catalog.byId.get(row.id);
    if (!base) continue;
    parcels.push({
      ...base,
      status: row.status,
      use: row.use,
      boughtAt: row.boughtAt,
      builtAt: row.builtAt,
    });
  }
  const state = {
    cash: saved.cash,
    tick: saved.tick,
    goals: {
      ...saved.goals,
      steps: { ...saved.goals.steps },
    },
    report: saved.report ? { ...saved.report } : null,
    parcels,
  };
  refreshWin(catalog, state);
  return state;
}

export function cheapestDevelopable(catalog, state, { district } = {}) {
  let best = null;
  for (const parcel of catalog.parcels) {
    if (district && parcel.district !== district) continue;
    if (state.parcels.some((owned) => owned.id === parcel.id)) continue;
    const priced = quote(catalog, state, parcel);
    const cost = priced.game.landPrice + priced.game.buildCost;
    if (cost > state.cash) continue;
    if (!best || cost < best.cost) best = { parcel, priced, cost };
  }
  return best;
}
