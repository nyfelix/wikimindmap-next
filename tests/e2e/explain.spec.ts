import { expect, test } from "@playwright/test";
import { mockWikipedia } from "./mockWikipedia.ts";

test.describe("explanations and pages", () => {
  test("labels the map on the first visit, and remembers Got it", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await expect(page.getByText("Labels explain the map.")).toBeVisible();
    await expect(page.getByText("A chapter: Introduction", { exact: true })).toBeVisible();
    await expect(page.getByText("The article", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
    await expect(page.getByText("Labels explain the map.")).toHaveCount(0);
    await page.keyboard.press("?");
    await expect(page.getByText("Labels explain the map.")).toBeVisible();
  });

  test("explains how the map is built, with the source revision", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
    await page.keyboard.press("i");
    const drawer = page.getByRole("complementary", { name: "How this map is built" });
    await expect(drawer).toContainText("Every link in the text of a chapter becomes a leaf");
    await expect(drawer).toContainText("revision 1374343935");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("shows the lenses that are coming, linking to the help page", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    const lenses = page.getByRole("navigation", { name: "Lens" });
    await expect(lenses.getByText("Chapters")).toHaveAttribute("aria-current", "true");
    await lenses.getByRole("link", { name: /Metro, coming soon/ }).click();
    await expect(page).toHaveURL(/\/help\/lenses#metro$/);
    await expect(page.getByRole("heading", { name: /Metro/ })).toBeVisible();
  });

  test("the logo menu leads to About, which says the project is independent", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await page.getByRole("button", { name: "WikiMindMap menu" }).click();
    await page.getByRole("menuitem", { name: "About" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText("not affiliated with or endorsed by the Wikimedia Foundation").first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "← Back to the map" }).click();
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
  });
});
