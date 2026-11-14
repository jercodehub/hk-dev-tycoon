import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  createCampaign,
  createCampaignCatalog,
  rollOffers,
  serializeCampaign,
} from "../game/campaign.js";

const balance = JSON.parse(readFileSync(new URL("../game/campaign-balance.json", import.meta.url), "utf8"));
const market = JSON.parse(readFileSync(new URL("../data/market-stats.json", import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ market, balance });

function privateSave() {
  for (let seed = 1; seed < 80; seed += 1) {
    const raw = createCampaign(catalog, { seed, company: { name: "測試地產", chairName: "陳總" } });
    const state = rollOffers({
      ...raw,
      completed: 4,
      cash: 3_500_000_000,
      reputation: 71,
      onboarding: { completed: true, step: "done" },
      flags: { ...raw.flags, landTender: true },
    }, catalog);
    if (state.offers.some((offer) => offer.type === "private" && offer.privateKind === "industrial")) {
      return serializeCampaign(state);
    }
  }
  throw new Error("no industrial plot in rotation");
}

async function openGate(page) {
  await page.addInitScript(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, ["hk-dev-tycoon-v3", privateSave()]);
  await page.goto("/");
  await expect(page.locator(".plot-premium").first()).toContainText("補地價");
  await page.locator('button[data-action="buy"]').first().click();
  await expect(page.locator(".premium-grid")).toBeVisible();
}

test("a private plot asks for the premium before any contractor", async ({ page }) => {
  await openGate(page);
  await expect(page.locator(".premium-option")).toHaveCount(3);
  await expect(page.locator('button[data-action="premium-standard"]')).toContainText("標準金額");
  await page.locator('button[data-action="premium-standard"]').click();
  await expect(page.locator(".shell")).toHaveAttribute("data-phase", "build");
  await expect(page.locator(".premium-grid")).toHaveCount(0);
  await expect(page.locator(".clist, .crow, .contractor").first()).toBeVisible();
});

test("the deferred route keeps the cash and unlocks the build", async ({ page }) => {
  await openGate(page);
  const before = await page.locator(".cash").innerText();
  await page.locator('button[data-action="premium-actual"]').click();
  await expect(page.locator(".shell")).toHaveAttribute("data-phase", "build");
  await expect(page.locator(".cash")).toHaveText(before);
});
