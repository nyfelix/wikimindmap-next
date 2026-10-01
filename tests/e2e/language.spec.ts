import { expect, test } from "@playwright/test";
import { mockWikipedia } from "./mockWikipedia.ts";

test.describe("Wikipedia language (US-09)", () => {
  test("switches to the same article in another language", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
    await page.getByRole("button", { name: /Wikipedia language: en/ }).click();
    await page.getByRole("combobox", { name: "Find a language" }).fill("deut");
    await page.getByRole("option", { name: /Deutsch/ }).click();
    await expect(page).toHaveURL(/\/de\/Mindmap$/);
    await expect(page.getByRole("button", { name: "About Mindmap" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fold Einleitung" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Trail" })).toContainText("Mind map›Mindmap");
  });

  test("searches in the chosen language when the article isn't there", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await page.getByRole("button", { name: /Wikipedia language: en/ }).click();
    await page.getByRole("combobox", { name: "Find a language" }).fill("Español");
    await expect(page.getByRole("option", { name: /español/i })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText("has no article on es.wikipedia.org")).toBeVisible();
    await expect(page.getByRole("button", { name: /Wikipedia language: es/ })).toBeVisible();
  });

  test("starts in the browser language", async ({ browser }) => {
    const context = await browser.newContext({ locale: "de-CH" });
    const page = await context.newPage();
    await mockWikipedia(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "About Mindmap" })).toBeVisible();
    await context.close();
  });
});
