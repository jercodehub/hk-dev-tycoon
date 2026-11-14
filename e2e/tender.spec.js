import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  createCampaign,
  createCampaignCatalog,
  serializeCampaign,
} from "../game/campaign.js";

const balance = JSON.parse(readFileSync(new URL("../game/campaign-balance.json", import.meta.url), "utf8"));
const market = JSON.parse(readFileSync(new URL("../data/market-stats.json", import.meta.url), "utf8"));
const catalog = createCampaignCatalog({ market, balance });

function landSave() {
  const base = createCampaign(catalog, { seed: 20261114, company: { name: "測試地產", chairName: "陳總" } });
  return serializeCampaign({
    ...base,
    completed: 4,
    cash: 900000000,
    reputation: 71,
    onboarding: { completed: true, step: "done" },
    flags: { ...base.flags, landTender: true },
  });
}

async function openTender(page) {
  await page.addInitScript(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, ["hk-dev-tycoon-v3", landSave()]);
  await page.goto("/");
  await expect(page.locator('button[data-action="tender-open"]').first()).toBeVisible();
  await page.locator('button[data-action="tender-open"]').first().click();
  await expect(page.locator("#tender-bid")).toBeVisible();
}

test("a sealed bid shows the range, blocks silly money and awards the site", async ({ page }) => {
  await openTender(page);
  await expect(page.locator(".tender-panel").first()).toContainText("底價情報");

  await page.locator("#tender-bid").fill("90000");
  await page.locator("#tender-bid").dispatchEvent("input");
  await expect(page.locator("#tender-over")).toBeVisible();
  await expect(page.locator("#tender-submit")).toBeDisabled();

  await page.locator("#tender-bid").fill("3900");
  await page.locator("#tender-bid").dispatchEvent("input");
  await expect(page.locator("#tender-submit")).toBeEnabled();
  await page.locator("#tender-submit").click();

  await expect(page.locator(".tender-result")).toContainText("中標");
  await page.locator('button[data-action="tender-award"]').click();
  await expect(page.locator(".shell")).toHaveAttribute("data-phase", "build");
});

test("a low ball loses, refunds the deposit and narrows the intel", async ({ page }) => {
  await openTender(page);
  await page.locator("#tender-bid").fill("1200");
  await page.locator("#tender-bid").dispatchEvent("input");
  await page.locator("#tender-submit").click();

  await expect(page.locator(".tender-result")).toContainText("輸標");
  await expect(page.locator(".tender-result")).toContainText("已退回");
  await page.locator('button[data-action="tender-dismiss"]').click();

  await page.locator('button[data-action="tender-open"]').first().click();
  await expect(page.locator(".tender-panel").first()).toContainText("±8%");
});
