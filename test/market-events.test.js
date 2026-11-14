import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCampaignCatalog, initialMarket, priceOffer, tickMarket } from "../game/campaign.js";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ balance: load("../game/campaign-balance.json"), market: load("../data/market-stats.json") });

test("market events rotate every five market steps and persist their modifiers", () => {
  let market = initialMarket();
  for (let i = 0; i < 5; i += 1) market = tickMarket(market, 0, catalog.balance);
  assert.equal(market.step, 5);
  assert.equal(market.event.id, "rate-cut");
  assert.equal(market.event.startedAt, 5);
  const before = priceOffer({ slot: "A", type: "gov", district: "沙田區", gfaFt2: 22000, premium: 1 }, { ...market, event: null }, catalog, "loose");
  const after = priceOffer({ slot: "A", type: "gov", district: "沙田區", gfaFt2: 22000, premium: 1 }, market, catalog, "loose");
  assert.ok(after.estBuildPerFt2 < before.estBuildPerFt2);
  assert.ok(after.landPerFt2 < before.landPerFt2);
});

test("the next event replaces the previous event without stacking modifiers", () => {
  let market = initialMarket();
  for (let i = 0; i < 10; i += 1) market = tickMarket(market, 0, catalog.balance);
  assert.equal(market.event.id, "rate-hike");
  assert.equal(market.event.startedAt, 10);
});
