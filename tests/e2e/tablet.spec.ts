import { expect, test } from "@playwright/test";
import { mockWikipedia } from "./mockWikipedia.ts";

test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

test("works on a tablet with touch (US-10)", async ({ page }) => {
  await mockWikipedia(page);
  await page.goto("/en/Mind_map");
  await page.getByRole("button", { name: "Got it" }).tap();

  // The lens switch is a menu.
  await expect(page.getByRole("navigation", { name: "Lens" })).toBeHidden();
  await page.getByRole("button", { name: "Lens: Chapters" }).tap();
  await expect(page.getByRole("menuitemradio", { name: /Chapters/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "Lens: Chapters" }).tap();

  // Panels don't overlap each other.
  const boxes = await Promise.all([
    page.getByRole("search").locator("xpath=..").boundingBox(),
    page.getByRole("button", { name: "Outline view" }).locator("xpath=..").boundingBox(),
    page.getByRole("navigation", { name: "Trail" }).boundingBox(),
    page.getByRole("group", { name: "Map controls" }).boundingBox(),
  ]);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlap =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `panels ${i} and ${j} overlap`).toBe(false);
    }
  }

  // Tap targets are at least 44 × 44 px.
  for (const name of ["Fold Origin", "Make Tony Buzan the center", "Zoom in", "Outline view"]) {
    const box = await page.getByRole("button", { name }).first().boundingBox();
    expect(box!.width, name).toBeGreaterThanOrEqual(43.5);
    expect(box!.height, name).toBeGreaterThanOrEqual(43.5);
  }

  // Tap a fold toggle and a leaf.
  await page.getByRole("button", { name: "Fold Origin" }).tap();
  await expect(page).toHaveURL(/fold=1/);
  await page.getByRole("button", { name: "Preview Mental mapping" }).tap();
  await expect(page.getByRole("dialog", { name: "Preview: Mental mapping" })).toBeVisible();
});
