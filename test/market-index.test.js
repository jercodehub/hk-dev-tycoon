import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createCampaignCatalog,
  deriveMarket,
  hydrateMarket,
  initialMarket,
  marketIndex,
  tickMarket,
} from "../game/campaign.js";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ balance: load("../game/campaign-balance.json"), market: load("../data/market-stats.json") });

test("land and build costs are derived from the single price dial", () => {
  const market = deriveMarket(1.2, catalog.balance);
  assert.equal(market.price, 1.2);
  assert.ok(market.land > market.price, "land should outrun prices");
  assert.ok(market.build > 1 && market.build < market.price, "build cost should lag prices");
  const flat = deriveMarket(1, catalog.balance);
  assert.equal(flat.land, 1);
  assert.equal(flat.build, 1);
  assert.equal(flat.buyer, 1);
});

test("the index is the price dial on a 300-point base", () => {
  assert.equal(marketIndex({ price: 1 }), 300);
  assert.equal(marketIndex({ price: 1.18 }), 354);
});

test("a tick moves the dial and keeps the derived levels in step", () => {
  const next = tickMarket(initialMarket(), 0.05, catalog.balance);
  assert.equal(next.price, 1.05);
  assert.equal(next.land, deriveMarket(1.05, catalog.balance).land);
  assert.equal(next.build, deriveMarket(1.05, catalog.balance).build);
  assert.equal(next.buyer, deriveMarket(1.05, catalog.balance).buyer);
  assert.deepEqual(next.history, [1, 1.05]);
});

test("history keeps the last twelve readings", () => {
  let market = initialMarket();
  for (let i = 0; i < 20; i += 1) market = tickMarket(market, 0.01, catalog.balance);
  assert.equal(market.history.length, 12);
  assert.equal(market.history[11], market.price);
});

test("old saves without a history or derived levels still load", () => {
  const market = hydrateMarket({ price: 1.1, land: 1.9, build: 0.2, step: 3 }, catalog.balance);
  assert.equal(market.price, 1.1);
  assert.equal(market.land, deriveMarket(1.1, catalog.balance).land);
  assert.equal(market.build, deriveMarket(1.1, catalog.balance).build);
  assert.deepEqual(market.history, [1.1]);
  assert.equal(market.step, 3);
});
