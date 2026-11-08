import { test, expect } from "@playwright/test";
import { MIN_RESPONSE_MS } from "@/lib/constants";

test.describe("Game flow - happy path", () => {
  test("first visit teaches the rules, then 5 rounds update stats", async ({ page }) => {
    await page.goto("/");

    const swipeCard = page.getByTestId("swipe-card");
    await expect(swipeCard).toBeVisible({ timeout: 15000 });

    // A first-time visitor sees the hint and both direction labels before swiping
    await expect(page.getByTestId("swipe-hint")).toBeVisible();
    await expect(page.getByTestId("label-ai")).toHaveText(/AI/);
    await expect(page.getByTestId("label-real")).toHaveText(/Real/);

    for (let i = 0; i < 5; i++) {
      await expect(swipeCard).toBeVisible({ timeout: 10000 });
      // Anti-cheat rejects guesses faster than a human could look
      await page.waitForTimeout(MIN_RESPONSE_MS + 100);

      if (i % 2 === 0) {
        await page.keyboard.press("ArrowRight");
      } else {
        await page.keyboard.press("ArrowLeft");
      }

      const resultFlash = page.getByTestId("result-flash");
      await expect(resultFlash).toBeVisible({ timeout: 5000 });
      await expect(resultFlash).toHaveText(
        /^(Right|Correct|Yes|Good call|Nope|Not quite|That one|Wrong)/
      );
      await expect(resultFlash).toBeHidden({ timeout: 5000 });
    }

    // The hint is gone for good once the player has swiped
    await expect(page.getByTestId("swipe-hint")).toHaveCount(0);
    await page.reload();
    await expect(swipeCard).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("swipe-hint")).toHaveCount(0);

    const totalPlayed = page.getByTestId("total-played");
    await expect(totalPlayed).toContainText("5", { timeout: 5000 });
  });
});
