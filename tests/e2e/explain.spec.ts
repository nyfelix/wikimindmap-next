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

test("the Link direction label explains all three directions; no separate legend", async ({
  page,
}) => {
  await mockWikipedia(page);
  await page.goto("/en/Mind_map");
  await expect(page.getByText("Link direction", { exact: true })).toBeVisible();
  for (const name of ["Out:", "Both ways:", "In:"]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Link directions", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByText("Out:", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Map controls" }).getByText("both ways"),
  ).toHaveCount(0);
});

test("map labels don't overlap each other", async ({ page }) => {
  await mockWikipedia(page);
  await page.goto("/en/Mind_map");
  await expect(page.getByText("Link direction", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  const boxes = await page
    .locator('[class*="callout"]')
    .evaluateAll((els) =>
      els
        .map((e) => e.getBoundingClientRect())
        .map((r) => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom })),
    );
  expect(boxes.length).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1, `labels ${i} and ${j}`).toBe(
        false,
      );
    }
});
