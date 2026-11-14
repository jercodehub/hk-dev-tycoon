import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCampaign, createCampaignCatalog, emptyAssets, investCapital } from "../game/campaign.js";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ balance: load("../game/campaign-balance.json"), market: load("../data/market-stats.json") });
const company = { name: "測試發展", chairName: "主席", logo: "tower", color: "#e2b15a", avatar: "chair-1" };

test("capital purchases deduct cash and persist one asset level", () => {
  const state = createCampaign(catalog, { company, seed: 21 });
  const result = investCapital(catalog, state, "builder");
  assert.equal(result.ok, true);
  assert.equal(result.state.assets.builder, 1);
  assert.equal(result.state.cash, state.cash - 180000000);
  assert.equal(investCapital(catalog, result.state, "builder").ok, false);
});

test("empty assets provide backward-compatible defaults", () => {
  assert.deepEqual(emptyAssets(), { builder: 0, manager: 0, landBank: 0, ai: 0, district: 0, invested: 0 });
});
