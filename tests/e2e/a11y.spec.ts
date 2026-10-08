import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockWikipedia } from "./mockWikipedia.ts";

async function serious(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    );
}

test.describe("accessibility (US-11)", () => {
  test("the map, with labels, has no serious axe issues", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await expect(page.getByText("A chapter: Introduction", { exact: true })).toBeVisible();
    expect(await serious(page)).toEqual([]);
  });

  test("the outline, preview and drawer have no serious axe issues", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await page.getByRole("button", { name: "Got it" }).click();
    await page.keyboard.press("o");
    await expect(page.getByRole("region", { name: "Mind map" })).toBeVisible();
    expect(await serious(page)).toEqual([]);
    // The outline sits on the right, where its button is.
    const box = await page.getByRole("region", { name: "Mind map" }).boundingBox();
    expect(box!.x + box!.width).toBeGreaterThan(page.viewportSize()!.width - 30);
    await page.keyboard.press("i");
    // The drawer takes its place on the right.
    await expect(page.getByRole("region", { name: "Mind map" })).toHaveCount(0);
    expect(await serious(page)).toEqual([]);
  });

  test("the About page has no serious axe issues", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await serious(page)).toEqual([]);
  });

  test("the outline shows the map as lists, with directions in words", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await page.getByRole("button", { name: "Got it" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Fold Origin" })).toBeVisible();
    // The skip link comes first.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Show the map as an outline" })).toBeFocused();
    await page.keyboard.press("Enter");
    const outline = page.getByRole("region", { name: "Mind map" });
    await expect(outline.getByRole("button", { name: "Fold Origin" })).toBeVisible();
    await expect(outline.getByText("links both ways").first()).toBeVisible();
    await outline.getByRole("button", { name: "Fold Origin" }).click();
    await expect(page).toHaveURL(/fold=1/);
    await expect(outline.getByText("links", { exact: false }).first()).toBeVisible();
    await outline.getByRole("button", { name: "Unfold Origin" }).click();
    await outline.getByRole("button", { name: "Make Tony Buzan the center" }).first().click();
    await expect(page).toHaveURL(/Tony_Buzan/);
  });

  test("works with the keyboard only: search, map, preview, recenter, trail", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Concept_map");
    await page.getByRole("button", { name: "Got it" }).click();
    await page.keyboard.press("/");
    await page.keyboard.type("Mind");
    await expect(page.getByRole("option", { name: /Mind map/ })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/Mind_map/);
    // Wait for the Mind map itself (Concept map has an "Introduction" too).
    await expect(page.getByRole("button", { name: "Preview Popular psychology" })).toBeVisible();

    // Into the map: the center, then arrow keys along the branches.
    await page.getByRole("button", { name: "About Mind map" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("button", { name: "Fold Introduction" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: "Fold Origin" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("button", { name: "Preview Popular psychology" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: "Preview Tony Buzan" })).toBeFocused();

    // Preview, then recenter from the card.
    await page.keyboard.press("Enter");
    const card = page.getByRole("dialog", { name: "Preview: Tony Buzan" });
    await expect(card).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(card.getByRole("button", { name: "⊕ Make it the center" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/Tony_Buzan/);
    // Focus lands on the new center.
    await expect(page.getByRole("button", { name: "About Tony Buzan" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Fold Introduction" })).toBeVisible();

    // Back along the trail.
    await page
      .getByRole("navigation", { name: "Trail" })
      .getByRole("button", { name: "Mind map" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/Mind_map/);
  });
});
