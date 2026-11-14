import { test, expect } from "@playwright/test";

test("layout stays usable at the configured viewport", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await page.getByRole("button", { name: "開業" }).click();

  const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  const smallButtons = await page.locator("button.primary, button.ghost, button.chip, button.choice, .dock button").evaluateAll((buttons) => buttons
    .filter((button) => button.offsetParent !== null)
    .map((button) => ({ text: button.textContent?.trim(), height: button.getBoundingClientRect().height }))
    .filter(({ height }) => height < 44));
  expect(smallButtons).toEqual([]);

  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.locator("body")).toContainText("First project");
  const englishDimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
  expect(englishDimensions.body).toBeLessThanOrEqual(englishDimensions.viewport);
  expect(errors).toEqual([]);
});
