import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MANAGEMENT_FEE_PER_FT2_YEAR,
  UNIT_SPECS,
  ownLevel,
  ownSpec,
  chooseContractor,
  chooseLand,
  commitSale,
  confirmSettle,
  contractorQuote,
  createCampaign,
  createCampaignCatalog,
  emptyAssets,
  hydrateCampaign,
  investCapital,
  projectPresetMix,
  serializeCampaign,
  settlementPreview,
} from "../game/campaign.js";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ balance: load("../game/campaign-balance.json"), market: load("../data/market-stats.json") });
const company = { name: "測試發展", chairName: "主席", logo: "tower", color: "#e2b15a", avatar: "chair-1" };

function bought(seed = 8, cash = 0) {
  const state = createCampaign(catalog, { company, seed });
  const rich = cash ? { ...state, cash: state.cash + cash } : state;
  return chooseLand(catalog, rich, "A").state;
}

function playOne(state, contractor = "huimen") {
  const mix = projectPresetMix(catalog, state);
  const built = chooseContractor(catalog, state, contractor, mix, "cash", "standard");
  assert.equal(built.ok, true, built.error);
  const sold = commitSale(catalog, built.state, { price: "market", leftover: "cut" });
  assert.equal(sold.ok, true, sold.error);
  return sold.state;
}

function soldFt2Of(state) {
  const byType = state.project.sale.byType;
  return UNIT_SPECS.reduce((sum, spec) => sum + ((byType?.[spec.id]?.sold || 0) * spec.ft2), 0);
}

test("the in-house contractor only unlocks after buying the construction company", () => {
  const base = bought(8);
  const mix = projectPresetMix(catalog, base);
  const blocked = chooseContractor(catalog, base, "own", mix, "cash", "standard");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "bad_contractor");

  const owned = investCapital(catalog, { ...base, cash: base.cash + 500000000 }, "builder").state;
  const ownQuote = contractorQuote(catalog, owned, "own");
  const huimen = contractorQuote(catalog, owned, "huimen");
  assert.equal(ownQuote.cost, Math.round(huimen.cost * 0.8));
  assert.ok(ownQuote.collapse < huimen.collapse);
  assert.equal(chooseContractor(catalog, owned, "own", projectPresetMix(catalog, owned), "cash", "standard").ok, true);
});

test("owning the builder no longer discounts outside contractors", () => {
  const state = bought(12);
  const plain = contractorQuote(catalog, state, "huimen");
  const owned = { ...state, assets: { ...emptyAssets(), builder: 1 } };
  const discounted = contractorQuote(catalog, owned, "huimen");
  assert.equal(discounted.cost, plain.cost);
});

test("management fees are paid on cumulative sold area once the manager is owned", () => {
  const settled = playOne(bought(9));
  const area = soldFt2Of(settled);
  assert.ok(area > 0);
  const fee = Math.round(area * MANAGEMENT_FEE_PER_FT2_YEAR);

  const without = confirmSettle(catalog, settled);
  const withManager = confirmSettle(catalog, { ...settled, assets: { ...emptyAssets(), manager: 1 } });
  assert.equal(withManager.ok, true);
  assert.equal(withManager.state.cash - without.state.cash, fee);
  assert.equal(withManager.state.managedFt2, area);
  assert.equal(withManager.state.history.at(-1).soldFt2, area);
});

test("fees grow with the portfolio across projects", () => {
  const prior = 1200000;
  const project = playOne(bought(15));
  const result = confirmSettle(catalog, { ...project, managedFt2: prior, assets: { ...emptyAssets(), manager: 1 } }).state;
  const thisProject = soldFt2Of(project);
  assert.equal(result.managedFt2, prior + thisProject);
  assert.equal(result.history.at(-1).soldFt2, thisProject);
  assert.equal(
    result.cash - confirmSettle(catalog, { ...project, managedFt2: prior }).state.cash,
    Math.round((prior + thisProject) * MANAGEMENT_FEE_PER_FT2_YEAR),
  );
});

test("the settlement preview shows the fee that will actually be paid", () => {
  const project = playOne(bought(11));
  const withManager = { ...project, assets: { ...emptyAssets(), manager: 1 } };
  const preview = settlementPreview(catalog, withManager);
  const settled = confirmSettle(catalog, withManager).state;
  assert.equal(preview.cash, settled.cash);
});

test("the in-house contractor levels at 5 and 12 delivered projects", () => {
  assert.equal(ownLevel(0).level, 1);
  assert.equal(ownLevel(4).level, 1);
  assert.equal(ownLevel(5).level, 2);
  assert.equal(ownLevel(11).level, 2);
  assert.equal(ownLevel(12).level, 3);
  assert.equal(ownLevel(40).level, 3);

  const lv1 = ownSpec(catalog.balance, 0);
  const lv2 = ownSpec(catalog.balance, 5);
  const lv3 = ownSpec(catalog.balance, 12);
  assert.ok(lv1.costMul > lv2.costMul && lv2.costMul > lv3.costMul);
  assert.ok(lv1.leak > lv2.leak && lv2.leak > lv3.leak);
  assert.ok(lv1.collapse > lv2.collapse && lv2.collapse > lv3.collapse);
  assert.ok(lv1.quality < lv3.quality);
});

test("quotes and completion both follow the in-house level", () => {
  const owned = investCapital(catalog, bought(31, 4000000000), "builder").state;
  const lv1Quote = contractorQuote(catalog, owned, "own");
  const lv3Quote = contractorQuote(catalog, { ...owned, ownBuilds: 12 }, "own");
  assert.ok(lv3Quote.cost < lv1Quote.cost);

  const played = playOne(owned, "own");
  const settled = confirmSettle(catalog, played).state;
  assert.equal(settled.history.at(-1).contractor, "own");
  assert.equal(settled.ownBuilds, 1);
});

test("ownBuilds is saved and older saves derive it from history", () => {
  const save = serializeCampaign({ ...bought(33, 4000000000), ownBuilds: 7 });
  assert.equal(save.ownBuilds, 7);
  assert.equal(hydrateCampaign(catalog, save).ownBuilds, 7);

  const legacy = { ...save };
  delete legacy.ownBuilds;
  legacy.history = [
    { index: 1, skipped: false, contractor: "own", sold: 100 },
    { index: 2, skipped: false, contractor: "huimen", sold: 100 },
    { index: 3, skipped: true, contractor: "own" },
  ];
  assert.equal(hydrateCampaign(catalog, legacy).ownBuilds, 1);
});

test("legacy saves without sold area get a per-project estimate", () => {
  const settled = playOne(bought(21));
  const done = confirmSettle(catalog, { ...settled, assets: { ...emptyAssets(), manager: 1 } }).state;
  const save = serializeCampaign(done);
  delete save.managedFt2;
  for (const item of save.history) delete item.soldFt2;
  const restored = hydrateCampaign(catalog, save);
  const expected = save.history.reduce((sum, item) => sum + (item.skipped ? 0 : (item.sold || 0) * 450), 0);
  assert.equal(restored.managedFt2, expected);
  assert.equal(restored.history.at(-1).soldFt2, (save.history.at(-1).sold || 0) * 450);
});
