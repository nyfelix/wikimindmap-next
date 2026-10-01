import { expect, test, type Page } from "@playwright/test";
import { mockWikipedia } from "./mockWikipedia.ts";

const leaves = (page: Page) => page.locator('[data-node="leaf"]');
const trail = (page: Page) => page.getByRole("navigation", { name: "Trail" });

test.describe("live map (mocked Wikipedia)", () => {
  test("opens a map by URL and replaces a redirect title with the real one", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mindmap");
    await expect(page).toHaveURL(/\/en\/Mind_map$/);
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
    await expect(leaves(page).first()).toBeVisible();
    // Direction symbols turn from pending to out / both ways once links back are checked.
    await expect(page.locator('[data-node="leaf"] rect[width="18"]').first()).toBeVisible();
    await expect(page).toHaveTitle("Mind map · WikiMindMap");
  });

  test("folds a chapter and keeps it in the URL", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await expect(leaves(page).first()).toBeVisible();
    const before = await leaves(page).count();
    await page.getByRole("button", { name: "Fold Origin" }).click();
    await expect(page).toHaveURL(/fold=1/);
    await expect(page.getByText(/^\+\d+ links$/)).toBeVisible();
    // Folded leaves fade out, then they are gone.
    await expect.poll(() => leaves(page).count()).toBeLessThan(before);
  });

  test("previews a leaf, recenters, and goes back along the trail without network", async ({
    page,
  }) => {
    const log = await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await page.getByRole("button", { name: "Preview Tony Buzan" }).first().click();
    const card = page.getByRole("dialog", { name: "Preview: Tony Buzan" });
    await expect(card).toContainText("Anthony Peter Buzan");
    await expect(card).toContainText("In Origin");
    await card.getByRole("button", { name: "⊕ Make it the center" }).click();

    await expect(page).toHaveURL(/\/en\/Tony_Buzan$/);
    await expect(page.getByRole("button", { name: "About Tony Buzan" })).toBeVisible();
    await expect(trail(page)).toContainText("Mind map›Tony Buzan");

    await page.getByRole("button", { name: "Make Albert Einstein the center" }).first().click();
    await expect(page).toHaveURL(/\/en\/Albert_Einstein$/);
    await expect(page.getByRole("button", { name: "About Albert Einstein" })).toBeVisible();

    const requests = log.requests.length;
    await page.goBack();
    await expect(page.getByRole("button", { name: "About Tony Buzan" })).toBeVisible();
    await trail(page).getByRole("button", { name: "Mind map" }).click();
    await expect(page).toHaveURL(/\/en\/Mind_map$/);
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
    // The steps ahead stay on the trail.
    await expect(trail(page)).toContainText("Albert Einstein");
    expect(log.requests.slice(requests)).toEqual([]);
  });

  test("keeps the trail after a reload", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await page.getByRole("button", { name: "Make Tony Buzan the center" }).first().click();
    await expect(page).toHaveURL(/Tony_Buzan/);
    await page.reload();
    await expect(trail(page)).toContainText("Mind map›Tony Buzan");
  });

  test("searches with suggestions and the keyboard", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
    await page.keyboard.press("/");
    await page.keyboard.type("che");
    await expect(page.getByRole("option", { name: /Chess/ })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/Chess$/);

    await expect(page.getByRole("button", { name: "About Chess" })).toBeVisible();
    await page.keyboard.press("/");
    await page.keyboard.type("zzzz");
    await expect(page.getByText("No article found for ‘zzzz’")).toBeVisible();
  });

  test("shows a missing article with a search field", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/No_such_article");
    await expect(page.getByText("This article doesn’t exist on en.wikipedia.org")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search Wikipedia" })).toHaveValue(
      "No such article",
    );
  });

  test("shows a network error with a retry button", async ({ page }) => {
    await mockWikipedia(page, { failing: ["Chess"] });
    await page.goto("/en/Chess");
    await expect(page.getByText("Wikipedia didn’t answer.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("the start page shows the map of Mind map with search focused", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search Wikipedia" })).toBeFocused();
    await expect(page.getByRole("option", { name: /Chess/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Random article/ })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("works without IndexedDB", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", { value: undefined });
    });
    await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await expect(leaves(page).first()).toBeVisible();
    await page.getByRole("button", { name: "Make Tony Buzan the center" }).first().click();
    await expect(page.getByRole("button", { name: "About Tony Buzan" })).toBeVisible();
  });
});
