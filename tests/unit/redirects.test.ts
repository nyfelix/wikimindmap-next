import { Window } from "happy-dom";
import { afterAll, describe, expect, it } from "vitest";
import { redirectTargets, uniqueLinks } from "../../src/core/links.ts";
import type { Article, LinkOccurrence } from "../../src/core/types.ts";
import type { HttpClient } from "../../src/sources/http.ts";
import { parseParsoid } from "../../src/sources/parsoid.ts";
import {
  redirectPairs,
  resolveRedirects,
  type RedirectsResponse,
} from "../../src/sources/redirects.ts";
import { fixture, readJson, readText, siteinfo, type Fixture } from "./fixtures.ts";

const window = new Window();
const domParser = new window.DOMParser() as unknown as DOMParser;
afterAll(() => window.happyDOM.close());

function article(f: Fixture): Article {
  return parseParsoid(readText(f, "page.html"), f.ref, siteinfo(f.ref.lang), domParser);
}

/** Answers action=query&redirects from the recorded batches, for whichever titles are asked. */
function recordedClient(f: Fixture) {
  const batches = readJson<RedirectsResponse[]>(f, "redirects.json");
  const normalized = batches.flatMap((b) => b.query?.normalized ?? []);
  const redirects = batches.flatMap((b) => b.query?.redirects ?? []);
  const requests: string[][] = [];
  const client: HttpClient = {
    getText: () => Promise.reject(new Error("not used")),
    async getJson<T>(url: string) {
      const titles = new URL(url).searchParams.get("titles")?.split("|") ?? [];
      requests.push(titles);
      const asked = new Set(titles);
      const norm = normalized.filter((n) => asked.has(n.from));
      const canonical = new Set([...titles, ...norm.map((n) => n.to)]);
      const data: RedirectsResponse = {
        query: { normalized: norm, redirects: redirects.filter((r) => canonical.has(r.from)) },
      };
      return { data: data as T, url, status: 200, headers: {} };
    },
  };
  return { client, requests };
}

describe("resolveRedirects", () => {
  it("resolves the redirect links of Mind map", async () => {
    const f = fixture("en", "Mind map");
    const { client } = recordedClient(f);
    const map = await resolveRedirects("en", redirectTargets(article(f)), client);
    expect(map.get("Concept maps")).toBe("Concept map");
    // A redirect to a section resolves to the page; the fragment is dropped.
    expect(map.get("Knowledge visualization")).toBe("Visualization (graphics)");
    expect(map.has("Tony Buzan")).toBe(false);
  });

  it("covers every redirect target the parser finds", async () => {
    for (const f of [
      fixture("en", "Mind map"),
      fixture("de", "Zürich"),
      fixture("fr", "Carte heuristique"),
    ]) {
      const targets = redirectTargets(article(f));
      const map = await resolveRedirects(f.ref.lang, targets, recordedClient(f).client);
      expect(targets.filter((t) => !map.has(t))).toEqual([]);
    }
  });

  it("asks for at most 50 titles per request", async () => {
    const f = fixture("en", "World War II");
    const { client, requests } = recordedClient(f);
    const targets = redirectTargets(article(f));
    expect(targets.length).toBeGreaterThan(100);
    await resolveRedirects("en", [...targets, ...targets], client);
    expect(requests).toHaveLength(Math.ceil(targets.length / 50));
    expect(Math.max(...requests.map((r) => r.length))).toBeLessThanOrEqual(50);
    expect(new Set(requests.flat()).size).toBe(targets.length);
  });

  it("makes no request for no titles", async () => {
    const { client, requests } = recordedClient(fixture("en", "Mind map"));
    expect((await resolveRedirects("en", [], client)).size).toBe(0);
    expect(requests).toHaveLength(0);
  });
});

describe("redirectPairs", () => {
  it("applies normalization, then redirects", () => {
    const data: RedirectsResponse = {
      query: {
        normalized: [{ from: "mind-map", to: "Mind-map" }],
        redirects: [{ from: "Mind-map", to: "Mind map" }],
      },
    };
    expect(redirectPairs(["mind-map", "Mind map"], data)).toEqual([["mind-map", "Mind map"]]);
  });
});

describe("uniqueLinks", () => {
  const link = (target: string, order: number): LinkOccurrence => ({
    target,
    text: target,
    order,
    origin: "body",
    redLink: false,
    redirect: false,
  });

  it("merges links that resolve to the same article, in order of first occurrence", async () => {
    const f = fixture("en", "Mind map");
    const parsed = article(f);
    const redirects = await resolveRedirects(
      "en",
      redirectTargets(parsed),
      recordedClient(f).client,
    );
    const section = parsed.sections.find(
      (s) => s.title === "Differences from other visualizations",
    )!;
    const targets = section.links.map((l) => l.target);
    expect(targets).toEqual(expect.arrayContaining(["Concept map", "Concept maps"]));

    const unique = uniqueLinks(section.links, redirects);
    const conceptMap = unique.filter((u) => u.target === "Concept map");
    expect(conceptMap).toHaveLength(1);
    expect(conceptMap[0]!.occurrences.map((o) => o.target)).toEqual([
      "Concept map",
      "Concept maps",
    ]);
    expect(unique.length).toBeLessThan(section.links.length);
  });

  it("drops links that resolve to the excluded title", () => {
    const redirects = new Map([
      ["Mind-map", "Mind map"],
      ["Mindmap", "Mind map"],
    ]);
    const unique = uniqueLinks(
      [link("Chess", 2), link("Mind-map", 0), link("Tony Buzan", 1), link("Mindmap", 3)],
      redirects,
      "Mind map",
    );
    expect(unique.map((u) => u.target)).toEqual(["Tony Buzan", "Chess"]);
  });
});
