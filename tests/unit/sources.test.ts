import { describe, expect, it } from "vitest";
import { parseSearch } from "../../src/sources/search.ts";
import { parseSummary, type SummaryResponse } from "../../src/sources/summary.ts";
import { safeStorage } from "../../src/ui/data/cache.ts";
import { fixture, readJson } from "./fixtures.ts";

describe("summary", () => {
  it("reads description, extract and thumbnail from the recorded response", () => {
    const summary = parseSummary(
      readJson<SummaryResponse>(fixture("en", "Mind map"), "summary.json"),
    );
    expect(summary?.title).toBe("Mind map");
    expect(summary?.description).toBe("Diagram to visually organize information");
    expect(summary?.extract).toMatch(/^A mind map is a/);
    expect(summary?.thumbnail?.url).toMatch(/^https:\/\//);
  });

  it("returns nothing for a missing page", () => {
    expect(parseSummary({ query: { pages: [{ title: "Nope", missing: true }] } })).toBeUndefined();
  });
});

describe("search", () => {
  it("keeps title and description and fixes protocol-relative thumbnails", () => {
    const parsed = parseSearch({
      pages: [
        {
          title: "Mindmap",
          description: "Graph",
          thumbnail: { url: "//thumb.wikimedia.org/x.jpg" },
        },
        { title: "MindManager", description: null, thumbnail: null },
      ],
    });
    expect(parsed).toEqual([
      { title: "Mindmap", description: "Graph", thumbnail: "https://thumb.wikimedia.org/x.jpg" },
      { title: "MindManager" },
    ]);
  });
});

describe("cache storage", () => {
  it("does nothing, without throwing, when IndexedDB is unavailable", async () => {
    const storage = safeStorage(() => {
      throw new Error("IndexedDB blocked");
    });
    await expect(storage.getItem("x")).resolves.toBeUndefined();
    await expect(storage.setItem("x", {} as never)).resolves.toBeUndefined();
    await expect(storage.removeItem("x")).resolves.toBeUndefined();
  });
});

describe("languages", () => {
  it("lists every open Wikipedia from the site matrix, by subdomain", async () => {
    const { parseSitematrix } = await import("../../src/sources/languages.ts");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "fixtures", "sitematrix.json"), "utf8"),
    );
    const wikis = parseSitematrix(raw);
    expect(wikis.length).toBeGreaterThan(300);
    expect(wikis.find((w) => w.lang === "de")).toEqual({
      lang: "de",
      name: "Deutsch",
      englishName: "German",
    });
    // Closed wikis are left out (Afar).
    expect(wikis.some((w) => w.lang === "aa")).toBe(false);
  });

  it("takes the first browser language", async () => {
    const { browserLang } = await import("../../src/ui/screens/start.ts");
    expect(browserLang(["de-CH", "en"])).toBe("de");
    expect(browserLang([])).toBe("en");
  });
});
