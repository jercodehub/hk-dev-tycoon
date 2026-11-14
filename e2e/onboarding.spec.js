import { test, expect } from "@playwright/test";

test("a new player can start the first project with the guided setup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開業" }).click();

  await expect(page.locator(".onboarding-banner")).toContainText("第一個項目");
  await page.locator('button.choice.plot[data-action="buy"]').first().click();

  await expect(page.locator(".onboarding-banner")).toContainText("建議方案");
  await expect(page.locator('button[data-action="loan"]')).toHaveCount(0);
  await page.locator('button[data-action="suggested-build"]').click();
  await expect(page.locator('button[data-action="pick-contractor"][data-id="huimen"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('button[data-action="confirm-build"]').click();
  const skipLapse = page.locator('button[data-action="skip-lapse"]');
  if (await skipLapse.count()) await skipLapse.click();
  await expect(page.locator('button[data-action="showflat"]')).toHaveCount(0);
  await expect(page.locator('button[data-action="loan"]')).toHaveCount(0);

  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});
