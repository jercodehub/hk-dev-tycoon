import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  createCampaign,
  createCampaignCatalog,
  serializeCampaign,
} from "../game/campaign.js";

const balance = JSON.parse(readFileSync(new URL("../game/campaign-balance.json", import.meta.url)));
const market = JSON.parse(readFileSync(new URL("../data/market-stats.json", import.meta.url)));
const catalog = createCampaignCatalog({ balance, market });
const legacySave = serializeCampaign(createCampaign(catalog, {
  seed: 19,
  company: { name: "舊存檔公司", logo: "tower", color: "#e2b15a" },
}));
delete legacySave.onboarding;

 test("an existing save sees the update notice once and keeps its progress", async ({ page }) => {
  await page.addInitScript((save) => {
    if (!sessionStorage.getItem("legacy-fixture")) {
      localStorage.setItem("hk-dev-tycoon-v3", JSON.stringify(save));
      sessionStorage.setItem("legacy-fixture", "1");
    }
  }, legacySave);
  await page.goto("/");

  await expect(page.locator(".legacy-notice")).toContainText("新手流程已更新");
  await page.locator('button[data-action="legacy-guide"]').click();
  await expect(page.locator(".legacy-notice")).toContainText("首個項目教學");
  await page.locator('button[data-action="legacy-close-guide"]').click();
  await expect(page.locator(".legacy-notice")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".legacy-notice")).toHaveCount(0);
});
