import { test, expect } from "@playwright/test";

test.describe("Game flow - happy path", () => {
  test("play 5 rounds and verify stats update", async ({ page }) => {
    await page.goto("/");

    // Wait for the first image card to appear
    const swipeCard = page.getByTestId("swipe-card");
    await expect(swipeCard).toBeVisible({ timeout: 15000 });

    for (let i = 0; i < 5; i++) {
      // Wait for current card to be ready
      await expect(swipeCard).toBeVisible({ timeout: 10000 });

      // Alternate between right and left arrow keys
      if (i % 2 === 0) {
        await page.keyboard.press("ArrowRight");
      } else {
        await page.keyboard.press("ArrowLeft");
      }

      // Wait for the result flash to appear (it may be brief)
      const resultFlash = page.getByTestId("result-flash");
      await expect(resultFlash).toBeVisible({ timeout: 5000 });

      // Wait for the result flash to disappear before next swipe
      await expect(resultFlash).toBeHidden({ timeout: 5000 });
    }

    // After 5 swipes, verify total played shows "5"
    const totalPlayed = page.getByTestId("total-played");
    await expect(totalPlayed).toContainText("5", { timeout: 5000 });
  });
});
