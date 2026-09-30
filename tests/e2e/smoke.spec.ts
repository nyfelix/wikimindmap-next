import { expect, test } from "@playwright/test";

test("the placeholder page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "WikiMindMap" })).toBeVisible();
});
