import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ASSEMBLY_OPTIONS, chooseLand, chooseContractor, createCampaign, createCampaignCatalog, contractorQuote } from "../game/campaign.js";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ balance: load("../game/campaign-balance.json"), market: load("../data/market-stats.json") });
const company = { name: "測試發展", chairName: "主席", logo: "tower", color: "#e2b15a", avatar: "chair-1" };

test("assembly offers only traditional and assembly construction", () => {
  assert.deepEqual(Object.keys(ASSEMBLY_OPTIONS), ["standard", "modular"]);
});

test("assembly options reduce build cost and increase available GFA", () => {
  let state = createCampaign(catalog, { company, seed: 31 });
  state = chooseLand(catalog, state, "A").state;
  const standard = contractorQuote(catalog, state, "huimen");
  const modularQuote = contractorQuote(catalog, { ...state, project: { ...state.project, assembly: "modular" } }, "huimen");
  assert.ok(modularQuote.cost < standard.cost);
  const mix = { ...state.project.offer.mixHint };
  const result = chooseContractor(catalog, state, "huimen", mix, "cash", "modular");
  assert.equal(result.ok, true);
  assert.ok(result.state.project.offer.gfaFt2 > state.project.offer.gfaFt2);
  assert.equal(result.state.project.assembly, "modular");
});
