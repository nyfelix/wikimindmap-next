import { expect, test } from "@playwright/test";
import { mockWikipedia } from "./mockWikipedia.ts";

const SHOTS = process.env.SHOTS;

test.describe("Links in / out lens (US-15)", () => {
  test("shows links here, both ways and links out, with totals and folding", async ({ page }) => {
    const log = await mockWikipedia(page);
    await page.goto("/en/Mind_map");
    await page.getByRole("button", { name: "Got it" }).click();
    await page
      .getByRole("navigation", { name: "Lens" })
      .getByRole("button", { name: "Links" })
      .click();
    await expect(page).toHaveURL(/\/en\/Mind_map\?lens=links$/);
    await expect(page.getByText("A direction: Links out", { exact: true })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/links-labels.png` });
    await page.getByRole("button", { name: "Got it" }).click();

    // Three zones with totals; Mind map has fewer than 2,000 incoming links.
    await expect(page.getByText(/^LINKS HERE · \d[\d,]*$/)).toBeVisible();
    await expect(page.getByText(/^BOTH WAYS · \d+$/)).toBeVisible();
    await expect(page.getByText(/^LINKS OUT · \d+$/)).toBeVisible();
    expect(log.requests.some((r) => r.includes("generator=backlinks"))).toBe(true);

    // Directions: in on the left, both ways as pills, out on the right.
    await expect(page.locator('[data-parent="in"][data-direction="in"]').first()).toBeVisible();
    await expect(page.locator('[data-parent="both"][data-direction="both"]').first()).toBeVisible();
    await expect(page.locator('[data-parent="out"][data-direction="out"]').first()).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/links-light.png` });

    // The preview names the side and the views.
    await page.locator('[data-parent="in"] [aria-label^="Preview "]').first().click();
    const card = page.getByRole("dialog");
    await expect(card).toContainText("Links here");
    await expect(card).toContainText("That article links here");
    await page.keyboard.press("Escape");

    // Each side folds.
    await page.getByRole("button", { name: "Fold Links here" }).click();
    await expect(page.locator('[data-parent="in"][data-node="leaf"]')).toHaveCount(0);
    await expect(page).toHaveURL(/fold=in/);
    await page.getByRole("button", { name: "Unfold Links here" }).click();
    await expect(page.locator('[data-parent="in"][data-node="leaf"]').first()).toBeVisible();
  });

  test("shows 2,000+ for a popular article", async ({ page }) => {
    await mockWikipedia(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en/Albert_Einstein?lens=links");
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByText(/^LINKS HERE · [\d,]+\+$/)).toBeVisible();
    // The capped list can't tell both ways from out: the links-back check decides, no pending.
    await expect(page.locator('[data-parent="out"][data-node="leaf"]').first()).toBeVisible();
    await expect(page.locator('[data-direction="pending"]')).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/links-dark.png` });
  });

  test("moves along the map with the arrow keys, into the band and back", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Mind_map?lens=links");
    await page.getByRole("button", { name: "Got it" }).click();
    await page.getByRole("button", { name: "About Mind map" }).focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator('[data-id="both"] [role="button"]').first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(":focus")).toHaveAttribute("aria-label", /^Preview /);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: "About Mind map" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(":focus")).toHaveAttribute("aria-label", /Links here/);
  });
});
