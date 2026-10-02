import { expect, test } from "@playwright/test";
import { mockWikipedia } from "./mockWikipedia.ts";

test.describe("Kinds lens (US-13, US-14)", () => {
  test("switches lenses on the same article and records the lens in the trail", async ({
    page,
  }) => {
    await mockWikipedia(page);
    await page.goto("/en/Albert_Einstein");
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByRole("button", { name: "Fold Introduction" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Lens" })
      .getByRole("button", { name: "Kinds" })
      .click();
    await expect(page).toHaveURL(/\/en\/Albert_Einstein\?lens=kinds$/);
    // Labels for a lens show the first time it is opened.
    await expect(page.getByText("A kind: Concepts", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    for (const kind of ["People", "Organizations", "Places", "Concepts", "Works", "Events"]) {
      await expect(page.getByRole("button", { name: `Fold ${kind}` })).toBeVisible();
    }

    // Preview: kind, instance of and views.
    // The most read person comes first.
    const person = page.locator('[data-id^="people/"] [aria-label^="Preview "]').first();
    const name = ((await person.getAttribute("aria-label")) ?? "").replace("Preview ", "");
    await person.click();
    const card = page.getByRole("dialog", { name: `Preview: ${name}` });
    await expect(card).toContainText("People · human");
    await expect(card).toContainText("Views per month");

    // Recenter keeps the lens; the trail records it.
    await card.getByRole("button", { name: "⊕ Make it the center" }).click();
    await expect(page).toHaveURL(/\?lens=kinds$/);
    await expect(page.getByRole("button", { name: `About ${name}` })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/lens=kinds/);
    await page
      .getByRole("navigation", { name: "Lens" })
      .getByRole("button", { name: "Chapters" })
      .click();
    await expect(page).toHaveURL(/\/en\/Albert_Einstein$/);
    await expect(page.getByRole("navigation", { name: "Trail" })).toContainText(
      `Albert Einstein›${name}`,
    );
  });

  test("shows empty kinds as dotted branches", async ({ page }) => {
    await mockWikipedia(page);
    await page.goto("/en/Tony_Buzan?lens=kinds");
    await expect(page.getByText("none linked").first()).toBeVisible();
  });
});
