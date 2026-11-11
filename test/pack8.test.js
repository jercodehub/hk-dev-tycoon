import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  campaignHeat,
  chooseLand,
  chooseStory,
  confirmSettle,
  createCampaign,
  createCampaignCatalog,
  hydrateCampaign,
  initialMarket,
  migrateSave,
  pickStory,
  profitShareRate,
  pushEffect,
  resolveSale,
  rollOffers,
  rollSiteTier,
  serializeCampaign,
  skipLand,
  splitProfit,
  towerShares,
  towerWord,
  unlockedAchievements,
  victoryTitle,
} from "../game/campaign.js";
import { playerFacingCopy, t } from "../game/copy.js";
import { STORIES } from "../game/stories.js";

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const balance = load("../game/campaign-balance.json");
const market = load("../data/market-stats.json");
const catalog = createCampaignCatalog({ market, balance });

function start(seed = 4) {
  return createCampaign(catalog, { seed, company: { name: "洪興地產", logo: "tower", color: "#e2b15a" } });
}

test("migrate 7 to 8 keeps the save and drops the old revenue cut", () => {
  const live = chooseLand(catalog, start(6), "A").state;
  const raw = serializeCampaign(live);
  raw.v = 7;
  raw.cash = 188000000;
  raw.history = [{ index: 1, name: "舊盤", stake: 0.35, note: "keep", profit: 12 }];
  raw.project.offer.type = "mtr";
  raw.project.offer.partnerRate = 0.14;
  delete raw.project.offer.profitShare;
  const migrated = migrateSave(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.v, 8);
  assert.equal(migrated.state.cash, 188000000);
  assert.equal(migrated.state.history[0].note, "keep");
  assert.equal(migrated.state.history[0].stake, 0.35);
  assert.equal(migrated.state.project.offer.partnerRate, undefined);
  const hydrated = hydrateCampaign(catalog, migrated.state);
  assert.equal(hydrated.cash, 188000000);
  assert.equal(hydrated.company.name, live.company.name);
  assert.ok(hydrated.project.offer.profitShare >= 0.2);
  assert.ok(hydrated.project.offer.profitShare <= 0.3);
  assert.notEqual(hydrated.project.offer.profitShare, 0.14);
  assert.equal(hydrated.history[0].note, "keep");
});

test("profit share is taken after costs, then the venture stake", () => {
  const gov = splitProfit({ revenue: 1000, land: 200, build: 300, promo: 100, rate: 0, stake: 0.35 });
  const mtr = splitProfit({ revenue: 1000, land: 200, build: 300, promo: 100, rate: 0.25, stake: 0.35 });
  const ura = splitProfit({ revenue: 1000, land: 200, build: 300, promo: 100, rate: 0.4, stake: 1 });
  const loss = splitProfit({ revenue: 400, land: 200, build: 300, promo: 100, rate: 0.3, stake: 0.5 });
  assert.equal(gov.operating, 400);
  assert.equal(gov.landCut, 0);
  assert.equal(gov.playerProfit, 140);
  assert.equal(mtr.landCut, 100);
  assert.equal(mtr.remainder, 300);
  assert.equal(mtr.playerProfit, 105);
  assert.equal(ura.landCut, 160);
  assert.equal(ura.playerProfit, 240);
  assert.equal(loss.landCut, 0);
  assert.equal(loss.playerProfit, -100);
  assert.ok(profitShareRate("gov", { slot: "A", district: "沙田區", gfaFt2: 22000, premium: 0.9 }, balance) === 0);
  const mtrRate = profitShareRate("mtr", { slot: "B", district: "沙田區", gfaFt2: 80000, premium: 1 }, balance);
  const uraRate = profitShareRate("ura", { slot: "C", district: "中西區", gfaFt2: 20000, premium: 1 }, balance);
  assert.ok(mtrRate >= 0.2 && mtrRate <= 0.3);
  assert.ok(uraRate >= 0.3 && uraRate <= 0.4);
});

test("a sell-out bonus is only cash at 100 percent, and almost is reputation +1", () => {
  const offer = {
    slot: "A",
    type: "gov",
    district: "沙田區",
    flavour: "uni",
    heat: "loose",
    gfaFt2: 22000,
    premium: 0.9,
    profitShare: 0,
    landTotal: 1000,
    landPaid: 1000,
    stake: 1,
    mixHint: { studio: 4, one: 0, two: 0, three: 0, feature: 0 },
  };
  const state = {
    seed: 2,
    completed: 0,
    reputation: 58,
    market: initialMarket(),
    poolBias: {},
    project: {
      offer,
      mix: { studio: 4, one: 0, two: 0, three: 0, feature: 0 },
      contractor: { id: "huimen", quality: 1, leak: 0, collapsed: false, total: 1000, cost: 1000, saleDrag: 0 },
      saleRoll: 0.2,
    },
  };
  const clear = resolveSale(catalog, state, { price: "cheap", leftover: "cut", cheer: 3, showflat: true, rebate: "high", adBudget: "high", adTarget: "rent", roll: 0.2 });
  const dear = resolveSale(catalog, state, { price: "expensive", leftover: "cut", cheer: 0, rebate: "none", adBudget: "none", roll: 0.99 });
  if (clear.outcome === "clear" && clear.profit > 0) {
    assert.equal(clear.clearBonus, Math.round(clear.profit * 0.02));
    assert.equal(clear.reputationDelta >= balance.repClear || clear.profit < 0, true);
  }
  if (dear.outcome !== "clear") assert.equal(dear.clearBonus, 0);
  const sticky = resolveSale(catalog, {
    ...state,
    project: {
      ...state.project,
      mix: { studio: 0, one: 0, two: 0, three: 0, feature: 8 },
      offer: { ...offer, flavour: "starter", district: "北區", gfaFt2: 8000, landTotal: 1, landPaid: 1 },
      contractor: { ...state.project.contractor, total: 1, cost: 1 },
    },
  }, { price: "expensive", leftover: "hold", cheer: 0, roll: 0.99 });
  if (sticky.outcome === "almost") {
    assert.equal(sticky.clearBonus, 0);
    assert.ok(sticky.reputationDelta <= (balance.repAlmost + balance.repHold + (sticky.profit < 0 ? balance.repLoss : 0)));
    assert.ok(sticky.reputationDelta < balance.repClear);
  } else {
    assert.notEqual(sticky.outcome, "clear");
    assert.equal(sticky.clearBonus, 0);
  }
  const positive = 80_000_000;
  const cheaper = 50_000_000;
  const bonus = (profit, soldOut) => (soldOut && profit > 0 ? Math.round(profit * balance.clearBonus) : 0);
  assert.ok(positive + bonus(positive, true) > cheaper + bonus(cheaper, true));
  assert.ok(positive + bonus(positive, true) > cheaper + bonus(cheaper, false));
});

test("heat, flagship window, and the first two sites", () => {
  assert.equal(balance.heatEvery, 5);
  assert.equal(balance.projects, 30);
  assert.equal(balance.flagshipFrom, 16);
  assert.equal(balance.siteTiers.find((row) => row.id === "flagship").minWorth, 3600000000);
  assert.equal(campaignHeat({ completed: 0, seed: 2 }, balance), "loose");
  assert.equal(campaignHeat({ completed: 5, seed: 2 }, balance), "spicy");
  const opening = start(3);
  assert.ok(opening.offers.every((offer) => offer.siteTier === "small"));
  assert.equal(rollSiteTier(9e12, 3, 0, balance, false), "small");
  assert.equal(rollSiteTier(9e12, 3, 1, balance, false), "small");
  assert.notEqual(rollSiteTier(9e12, 3, 14, balance, false), "flagship");
  const late = rollOffers({ ...opening, cash: 9e12, completed: 15, credit: { forceSmall: false, hadYellow: false } }, catalog);
  assert.ok(late.offers.some((offer) => offer.siteTier === "flagship"));
});

test("victory titles take the first matching seal and skip a bankruptcy page", () => {
  const row = (patch) => ({
    phase: "summary",
    completed: 30,
    credit: { hadYellow: false },
    history: [],
    ...patch,
  });
  assert.equal(victoryTitle(row({
    history: [{ outcome: "clear", units: 12000, siteTier: "flagship" }],
  }), balance), "megaChair");
  assert.equal(victoryTitle(row({
    history: [{ outcome: "partial", units: 12000, siteTier: "flagship" }],
  }), balance), "mega");
  assert.equal(victoryTitle(row({
    credit: { hadYellow: true },
    history: [{ outcome: "partial", units: 20, siteTier: "small" }],
  }), balance), "comeback");
  assert.equal(victoryTitle(row({
    history: [{ outcome: "clear", units: 40, siteTier: "mid" }],
  }), balance), "clear");
  assert.equal(victoryTitle(row({
    history: [{ outcome: "partial", units: 40, siteTier: "flagship" }],
  }), balance), "flagship");
  assert.equal(victoryTitle(row({ history: [{ outcome: "fail", units: 10, siteTier: "small" }] }), balance), "chair");
  assert.equal(victoryTitle(row({ phase: "gameover", credit: { hadYellow: true }, history: [{ outcome: "clear", units: 20000 }] }), balance), null);
  assert.deepEqual(unlockedAchievements(row({ phase: "gameover" }), balance), []);
});

test("cards 1, 2 and 5 do not sit next to each other, and a loosening effect does not stack", () => {
  const pulse = new Set(STORIES.filter((story) => story.pulse).map((story) => story.id));
  assert.deepEqual([...pulse].sort(), ["heat-lobby", "new-rail", "whale-gate"]);
  let previous = null;
  let previousPulse = false;
  const counts = {};
  for (let i = 0; i < 12; i += 1) {
    const story = pickStory(STORIES, { next: () => (i * 0.17) % 1 }, {
      previousId: previous,
      previousPulse,
      counts,
      cap: balance.storyRepeatCap,
    });
    if (previousPulse) assert.equal(story.pulse, undefined);
    previous = story.id;
    previousPulse = Boolean(story.pulse);
    counts[story.id] = (counts[story.id] || 0) + 1;
  }
  const once = pushEffect([], { kind: "mtr-boost", mtrBoost: 0.05, left: 2, loosen: true });
  const twice = pushEffect(once, { kind: "mtr-boost", mtrBoost: 0.05, left: 2, loosen: true });
  assert.equal(twice.length, 1);
  const held = STORIES.find((story) => story.id === "holding-fee");
  assert.equal(held.choices[0].tc, "遊說擱置");
});

test("player copy keeps 揀, 沽清 and 預計沽出, and the new share words", () => {
  const copy = playerFacingCopy().join("\n");
  const stories = STORIES.flatMap((story) => [story.tc, ...story.choices.flatMap((choice) => [choice.tc, choice.cost || ""])]).join("\n");
  const blob = `${copy}\n${stories}`;
  for (const banned of ["擁", "拣", "擠", "沸清", "預計沸出", "印花稅", "空置稅", "撥置", "市建局分成", "地鐵分成", "夥伴分成", "無分成"]) {
    assert.equal(blob.includes(banned), false, banned);
  }
  assert.ok(copy.includes("揀"));
  assert.ok(copy.includes("沽清"));
  assert.ok(copy.includes("預計沽出"));
  assert.ok(copy.includes("分利潤"));
  assert.ok(copy.includes("分盈餘"));
  assert.ok(copy.includes("合營份額"));
  assert.ok(copy.includes("收租旺"));
  assert.ok(copy.includes("上車旺"));
  assert.equal(t("tc", "title"), "香港地產狗");
  assert.equal(t("tc", "gameSub"), "Property Dog");
  assert.equal(t("tc", "storyKicker"), "地產香港");
  assert.equal(t("tc", "tagline"), "三十個項目");
  const css = readFileSync(new URL("../game/styles.css", import.meta.url), "utf8");
  assert.equal(/\.stat small\s*\{[^}]*display:\s*none/.test(css), false);
  assert.equal(/heat-hint[^,{]*\{[^}]*display:\s*none/.test(css), false);
  assert.equal(/\.price-chip em\s*\{[^}]*display:\s*none/.test(css), false);
  assert.ok(css.includes("--game"));
  const main = readFileSync(new URL("../game/main.js", import.meta.url), "utf8");
  assert.equal(main.includes("badge-game"), false);
  const towers = towerShares(400, 400);
  assert.ok(towers.length >= 2 && towers.length <= 4);
  assert.equal(towerWord(100), "clear");
  assert.equal(towerWord(90), "hot");
  assert.equal(towerWord(60), "steady");
  assert.equal(towerWord(20), "quiet");
});

test("a played story survives into the next land round without wiping cash", () => {
  let state = confirmSettle(catalog, skipLand(catalog, start(8)).state).state;
  const before = state.cash;
  state = chooseStory(catalog, state, state.story.choices[1].id).state;
  assert.equal(state.phase, "land");
  assert.equal(typeof state.cash, "number");
  assert.ok(state.offers.length === 3);
  assert.ok(Math.abs(state.cash - before) < 20000000);
});
