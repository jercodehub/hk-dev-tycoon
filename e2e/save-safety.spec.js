import { test, expect } from "@playwright/test";

test("new game requires confirmation and invalid imports preserve the current save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開業" }).click();
  await page.getByRole("button", { name: "選單" }).click();
  await page.getByRole("button", { name: "新公司" }).click();
  await expect(page.locator(".menu")).toContainText("確定要開始新遊戲");
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.locator(".onboarding-banner")).toBeVisible();

  await page.locator('input[data-action="import-save"]').setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await expect(page.locator(".menu")).toContainText("存檔無效");
  await expect(page.locator(".onboarding-banner")).toBeVisible();
});
