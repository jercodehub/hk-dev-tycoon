import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buy,
  build,
  cheapestDevelopable,
  createCatalog,
  createGame,
  gameIndex,
  hold,
  hydrate,
  indexMultiplier,
  netWorth,
  quote,
  rent,
  sell,
  serialize,
  tick,
} from "../game/engine.js";

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const balance = load("../game/balance.json");
const parcelsFile = load("../data/parcels.json");
const market = load("../data/market-stats.json");
const catalog = createCatalog({ parcels: parcelsFile, market, balance });

function playTutorial() {
  let state = createGame(catalog, { mode: "tutorial" });
  const pick = cheapestDevelopable(catalog, state, { district: "沙田區" });
  assert.ok(pick, "tutorial cash should develop at least one Sha Tin parcel");
  state = buy(catalog, state, pick.parcel.id).state;
  state = build(catalog, state, pick.parcel.id).state;
  state = rent(catalog, state, pick.parcel.id).state;
  const advanced = tick(catalog, state);
  assert.equal(advanced.ok, true);
  return { picked: pick, beforeTick: state, after: advanced.state };
}

test("catalog has ~400 residential parcels and no district prices", () => {
  assert.ok(parcelsFile.parcels.length >= 360 && parcelsFile.parcels.length <= 460);
  assert.equal(parcelsFile.source.usage, "住宅/綜合用途");
  assert.deepEqual(Object.keys(market.prices.averagePrices.areas).sort(), ["九龍", "新界", "港島"].sort());
  assert.equal(market.moneyPolicy.notPublished.includes("18 區"), true);
  for (const parcel of parcelsFile.parcels) {
    assert.equal(parcel.pricePerM2, undefined);
    assert.equal(parcel.officialPrice, undefined);
    assert.ok(["港島", "九龍", "新界"].includes(parcel.region));
  }
  const shaTin = market.areas["沙田區"];
  assert.equal(shaTin.price, undefined);
  assert.equal(typeof shaTin.stock, "number");
  assert.equal(typeof shaTin.vacancyPct, "number");
});

test("open-data $/m² stays on the region while game value absorbs district counts", () => {
  const state = createGame(catalog, { mode: "free" });
  const base = catalog.byId.get("ST-28");
  const asKowloonCity = { ...base, id: "synthetic-kc", district: "九龍城區", region: "九龍" };
  const asShaTinRegionPrice = { ...base, id: "synthetic-st", district: "沙田區", region: "九龍" };
  const city = quote(catalog, state, asKowloonCity);
  const quieter = quote(catalog, state, asShaTinRegionPrice);
  assert.equal(city.openData.hkdPerM2, quieter.openData.hkdPerM2);
  assert.equal(city.openData.hkdPerM2, market.prices.averagePrices.areas["九龍"].B.value);
  assert.ok(market.areas["九龍城區"].vacancyPct > market.areas["沙田區"].vacancyPct);
  assert.ok(city.game.saleable < quieter.game.saleable);
  assert.equal(city.openData.district, "九龍城區");
  assert.notEqual(city.game.gamePerM2, city.openData.hkdPerM2);
});

test("tutorial buy is Sha Tin only and spends the quoted land price", () => {
  const state = createGame(catalog, { mode: "tutorial" });
  const island = catalog.parcels.find((parcel) => parcel.district === "中西區");
  const denied = buy(catalog, state, island.id);
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "tutorial_sha_tin_only");
  assert.equal(denied.state, state);

  const pick = cheapestDevelopable(catalog, state, { district: "沙田區" });
  const bought = buy(catalog, state, pick.parcel.id);
  assert.equal(bought.ok, true);
  assert.equal(bought.state.cash, state.cash - pick.priced.game.landPrice);
  assert.equal(bought.state.parcels.length, 1);
  assert.equal(bought.state.parcels[0].status, "land");
  assert.equal(bought.state.goals.steps.buy, true);
  assert.equal(state.parcels.length, 0);
  assert.equal(state.cash, balance.tutorial.startingCash);
});

test("build, hold, rent, and sell follow the quoted game economy", () => {
  let state = createGame(catalog, { mode: "tutorial" });
  const pick = cheapestDevelopable(catalog, state, { district: "沙田區" });
  state = buy(catalog, state, pick.parcel.id).state;
  const priced = quote(catalog, state, pick.parcel);
  const tooSoon = rent(catalog, state, pick.parcel.id);
  assert.equal(tooSoon.error, "not_built");

  const built = build(catalog, state, pick.parcel.id);
  assert.equal(built.ok, true);
  assert.equal(built.state.cash, state.cash - priced.game.buildCost);
  assert.equal(built.state.parcels[0].status, "built");
  assert.equal(built.state.parcels[0].use, "hold");
  assert.equal(built.state.goals.steps.build, true);

  const rented = rent(catalog, built.state, pick.parcel.id);
  assert.equal(rented.state.goals.steps.rent, true);
  assert.equal(rented.state.parcels[0].use, "rent");
  const held = hold(catalog, rented.state, pick.parcel.id);
  assert.equal(held.state.parcels[0].use, "hold");

  const sold = sell(catalog, built.state, pick.parcel.id);
  assert.equal(sold.ok, true);
  assert.equal(sold.state.parcels.length, 0);
  assert.equal(
    sold.state.cash,
    built.state.cash + quote(catalog, built.state, pick.parcel).game.sellProceeds,
  );
  assert.ok(sold.state.cash < balance.tutorial.startingCash);
});

test("a quarter collects rent, moves the game index, and stops at 12", () => {
  const { beforeTick, after } = playTutorial();
  assert.equal(after.tick, 1);
  assert.equal(beforeTick.tick, 0);
  assert.equal(after.goals.steps.collect, true);
  assert.equal(after.goals.won, true);
  assert.equal(after.goals.finished, false);
  const priced = quote(catalog, after, after.parcels[0]);
  assert.equal(after.report.rentIncome, priced.game.rentPerQuarter);
  assert.equal(after.cash, beforeTick.cash + priced.game.rentPerQuarter - priced.game.holdingPerQuarter);
  assert.ok(Math.abs(indexMultiplier(balance, 1) - (1 + balance.indexDrift[0])) < 1e-12);
  assert.ok(gameIndex(catalog, 1).gameLevel > gameIndex(catalog, 0).openDataBase);

  let state = after;
  while (state.tick < 12) state = tick(catalog, state).state;
  assert.equal(state.tick, 12);
  assert.equal(state.goals.finished, true);
  assert.equal(state.goals.endReason, "quarters");
  const extra = tick(catalog, state);
  assert.equal(extra.ok, false);
  assert.equal(extra.error, "finished");
  assert.equal(extra.state.tick, 12);
});

test("insufficient cash and unpaid holding can end the game", () => {
  const state = createGame(catalog, { mode: "free" });
  const huge = catalog.parcels.reduce((best, parcel) => {
    const priced = quote(catalog, state, parcel);
    return !best || priced.game.landPrice > best.priced.game.landPrice ? { parcel, priced } : best;
  }, null);
  if (huge.priced.game.landPrice > state.cash) {
    const denied = buy(catalog, state, huge.parcel.id);
    assert.equal(denied.error, "insufficient_cash");
  }

  const broke = createGame(catalog, { mode: "free" });
  const land = cheapestDevelopable(catalog, broke);
  const owned = {
    ...land.parcel,
    status: "land",
    use: null,
    boughtAt: 0,
    builtAt: null,
  };
  const penniless = { ...broke, cash: 0, parcels: [owned] };
  const ended = tick(catalog, penniless);
  assert.equal(ended.state.goals.bankrupt, true);
  assert.equal(ended.state.goals.finished, true);
  assert.equal(penniless.cash, 0);
  assert.equal(buy(catalog, ended.state, land.parcel.id).error, "finished");
});

test("save round-trips ownership without trusting stored prices", () => {
  const { after } = playTutorial();
  const raw = serialize(after);
  raw.parcels[0].saleable = 1;
  const restored = hydrate(catalog, raw);
  assert.equal(restored.cash, after.cash);
  assert.equal(restored.tick, after.tick);
  assert.equal(restored.parcels[0].id, after.parcels[0].id);
  assert.equal(restored.parcels[0].status, "built");
  assert.equal(restored.parcels[0].saleable, undefined);
  assert.equal(restored.goals.won, true);
  const again = quote(catalog, restored, restored.parcels[0]);
  assert.equal(again.openData.region, "新界");
  assert.equal(again.openData.hkdPerM2, market.prices.averagePrices.areas["新界"].B.value);
});

test("idling for 12 quarters misses the free-play net-worth goal", () => {
  let state = createGame(catalog, { mode: "free" });
  assert.ok(netWorth(catalog, state) < balance.freePlay.targetNetWorth);
  for (let i = 0; i < 12; i += 1) state = tick(catalog, state).state;
  assert.equal(state.goals.finished, true);
  assert.equal(state.goals.won, false);
  assert.equal(netWorth(catalog, state), balance.freePlay.startingCash);
});

test("developing into the scripted upswing can clear the free-play goal", () => {
  let state = createGame(catalog, { mode: "free" });
  for (let i = 0; i < 4; i += 1) state = tick(catalog, state).state;
  const affordable = catalog.parcels
    .map((parcel) => ({ parcel, priced: quote(catalog, state, parcel) }))
    .map((entry) => ({
      ...entry,
      cost: entry.priced.game.landPrice + entry.priced.game.buildCost,
    }))
    .filter((entry) => entry.cost <= state.cash)
    .sort((a, b) => b.priced.game.saleable - a.priced.game.saleable);
  assert.ok(affordable.length > 0);
  for (const entry of affordable) {
    if (entry.cost > state.cash) continue;
    const bought = buy(catalog, state, entry.parcel.id);
    if (!bought.ok) continue;
    const built = build(catalog, bought.state, entry.parcel.id);
    if (!built.ok) {
      state = bought.state;
      continue;
    }
    state = rent(catalog, built.state, entry.parcel.id).state;
  }
  assert.ok(state.parcels.some((parcel) => parcel.use === "rent"));
  while (state.tick < 12) state = tick(catalog, state).state;
  for (const parcel of [...state.parcels]) state = sell(catalog, state, parcel.id).state;
  assert.equal(state.goals.won, true, `net worth ${netWorth(catalog, state)}`);
});
