import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  confirmSettle,
  createCampaign,
  createCampaignCatalog,
  hydrateCampaign,
  isOnboarding,
  migrateSave,
  serializeCampaign,
  skipLand,
} from "../game/campaign.js";

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const balance = load("../game/campaign-balance.json");
const market = load("../data/market-stats.json");
const catalog = createCampaignCatalog({ market, balance });

function start(seed = 7) {
  return createCampaign(catalog, { seed, company: { name: "啟岸發展", logo: "tower", color: "#e2b15a" } });
}

test("a new campaign starts in first-project onboarding", () => {
  const state = start();
  assert.deepEqual(state.onboarding, { completed: false, step: "first-project" });
  assert.equal(isOnboarding(state), true);
});

test("completing the first project ends onboarding, including a skipped project", () => {
  const state = start(11);
  const skipped = skipLand(catalog, state);
  assert.equal(skipped.ok, true);
  const settled = confirmSettle(catalog, skipped.state);
  assert.equal(settled.ok, true);
  assert.equal(settled.state.completed, 1);
  assert.deepEqual(settled.state.onboarding, { completed: true, step: "done" });
  assert.equal(isOnboarding(settled.state), false);
});

test("onboarding survives serialization and hydration", () => {
  const state = start(13);
  const restored = hydrateCampaign(catalog, serializeCampaign(state));
  assert.deepEqual(restored.onboarding, { completed: false, step: "first-project" });
  assert.equal(isOnboarding(restored), true);
});

test("legacy notice seen flag survives without changing the campaign", () => {
  const state = start(15);
  const marked = { ...state, flags: { ...state.flags, legacyNoticeSeen: true } };
  const restored = hydrateCampaign(catalog, serializeCampaign(marked));
  assert.equal(restored.flags.legacyNoticeSeen, true);
  assert.equal(restored.cash, state.cash);
  assert.equal(restored.completed, state.completed);
  assert.deepEqual(restored.offers.map((offer) => offer.slot), state.offers.map((offer) => offer.slot));
});

test("v8 saves without onboarding infer completion from project history", () => {
  const fresh = serializeCampaign(start(17));
  delete fresh.onboarding;
  const migratedFresh = migrateSave(fresh);
  assert.equal(migratedFresh.ok, true);
  assert.deepEqual(hydrateCampaign(catalog, migratedFresh.state).onboarding, {
    completed: false,
    step: "first-project",
  });

  const completed = serializeCampaign({ ...start(19), completed: 1 });
  delete completed.onboarding;
  const migratedCompleted = migrateSave(completed);
  assert.equal(migratedCompleted.ok, true);
  assert.deepEqual(hydrateCampaign(catalog, migratedCompleted.state).onboarding, {
    completed: true,
    step: "done",
  });
});
