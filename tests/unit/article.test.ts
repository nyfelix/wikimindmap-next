import { Window } from "happy-dom";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Article, Section } from "../../src/core/types.ts";
import { loadArticle, titleFromPageUrl } from "../../src/sources/article.ts";
import type { HttpClient, HttpResult } from "../../src/sources/http.ts";
import { NotFound } from "../../src/sources/http.ts";
import { parseFallback, type FallbackResponses } from "../../src/sources/parseFallback.ts";
import { parseParsoid } from "../../src/sources/parsoid.ts";
import { fixture, readJson, readText, siteinfo, type Fixture } from "./fixtures.ts";

const window = new Window();
const domParser = new window.DOMParser() as unknown as DOMParser;
afterAll(() => window.happyDOM.close());

const flat = (sections: Section[]): Section[] => sections.flatMap((s) => [s, ...flat(s.children)]);
const shape = (sections: Section[]): unknown =>
  sections.map((s) => ({ title: s.title, level: s.level, children: shape(s.children) }));
const bodyTargets = (a: Article) =>
  new Set(
    [a.lead, ...flat(a.sections)].flatMap((s) =>
      s.links.filter((l) => l.origin === "body").map((l) => l.target),
    ),
  );

function both(f: Fixture) {
  const parsoid = parseParsoid(readText(f, "page.html"), f.ref, siteinfo(f.ref.lang), domParser);
  const fallback = parseFallback(f.ref, readJson<FallbackResponses>(f, "fallback.json"));
  return { parsoid, fallback };
}

describe("parseFallback", () => {
  for (const [lang, title] of [
    ["en", "Mind map"],
    ["de", "Mindmap"],
  ] as const) {
    it(`matches the Parsoid result for ${lang}:${title}`, () => {
      const { parsoid, fallback } = both(fixture(lang, title));
      expect(fallback.source).toBe("fallback");
      expect(fallback.revisionId).toBe(parsoid.revisionId);
      expect(fallback.displayTitle).toBe(parsoid.displayTitle);
      expect(shape(fallback.sections)).toEqual(shape(parsoid.sections));
      expect(flat(fallback.sections).map((s) => s.housekeeping)).toEqual(
        flat(parsoid.sections).map((s) => s.housekeeping),
      );

      const expected = bodyTargets(parsoid);
      const found = bodyTargets(fallback);
      const overlap = [...expected].filter((t) => found.has(t)).length / expected.size;
      expect(overlap).toBeGreaterThanOrEqual(0.9);
    });
  }

  it("keeps only the links not found in subsections", () => {
    const { fallback } = both(fixture("en", "Mind map"));
    const research = fallback.sections.find((s) => s.title === "Research")!;
    const effectiveness = research.children.find((s) => s.title === "Effectiveness")!;
    expect(effectiveness.links.map((l) => l.target)).toContain("Spider diagram");
    expect(research.links.map((l) => l.target)).not.toContain("Spider diagram");
  });

  it("marks every link as body and as a possible redirect, numbered in section order", () => {
    const { fallback } = both(fixture("en", "Mind map"));
    const links = [fallback.lead, ...flat(fallback.sections)].flatMap((s) => s.links);
    expect(links.every((l) => l.origin === "body" && l.redirect)).toBe(true);
    expect(links.map((l) => l.order)).toEqual(links.map((_, i) => i));
  });
});

/** A fake client that answers from the fixtures of one article. */
function fixtureClient(f: Fixture, html = readText(f, "page.html")) {
  const fallback = readJson<FallbackResponses>(f, "fallback.json");
  const siteinfoRaw = JSON.parse(readText({ ...f, dir: `${f.dir}/..` }, "siteinfo.json"));
  const urls: string[] = [];
  const result = <T>(data: T, url: string): HttpResult<T> => ({
    data,
    url,
    status: 200,
    headers: {},
  });
  const client: HttpClient = {
    async getText(url) {
      urls.push(url);
      // rest.php answers a redirect title with 307 to the real title.
      return result(html, url.replace("/page/Mindmap/html", "/page/Mind_map/html?redirect=no"));
    },
    async getJson<T>(url: string) {
      urls.push(url);
      const params = new URL(url).searchParams;
      if (params.get("meta") === "siteinfo") return result(siteinfoRaw as T, url);
      if (params.get("prop")?.startsWith("tocdata")) return result(fallback.toc as T, url);
      const section = params.get("section");
      if (section && fallback.links[section]) return result(fallback.links[section] as T, url);
      throw new NotFound(url);
    },
  };
  return { client, urls };
}

describe("loadArticle", () => {
  const f = fixture("en", "Mind map");

  it("uses Parsoid and the real title behind a redirect", async () => {
    const { client, urls } = fixtureClient(f);
    const article = await loadArticle({ lang: "en", title: "Mindmap" }, { client, domParser });
    expect(article.source).toBe("parsoid");
    expect(article.ref.title).toBe("Mind map");
    expect(urls.some((u) => u.includes("action=parse"))).toBe(false);
  });

  it("falls back to action=parse when the HTML can't be parsed", async () => {
    const { client, urls } = fixtureClient(f, "<html><body><p>Not Parsoid</p></body></html>");
    const warn = vi.fn();
    const article = await loadArticle(f.ref, { client, domParser, warn });
    expect(article.source).toBe("fallback");
    expect(article.sections.map((s) => s.title)).toContain("Origin");
    expect(warn).toHaveBeenCalledOnce();
    expect(urls.filter((u) => u.includes("action=parse")).length).toBeGreaterThan(1);
  });

  it("does not fall back when the article doesn't exist", async () => {
    const client: HttpClient = {
      getText: async (url) => Promise.reject(new NotFound(url)),
      getJson: async <T>(url: string) => ({
        data: { query: { namespaces: {} } } as T,
        url,
        status: 200,
        headers: {},
      }),
    };
    await expect(loadArticle(f.ref, { client, domParser })).rejects.toBeInstanceOf(NotFound);
  });
});

describe("titleFromPageUrl", () => {
  it("reads the real title from a rest.php URL", () => {
    expect(
      titleFromPageUrl("https://en.wikipedia.org/w/rest.php/v1/page/Mind_map/html?redirect=no"),
    ).toBe("Mind map");
    expect(titleFromPageUrl("https://de.wikipedia.org/w/rest.php/v1/page/Z%C3%BCrich/html")).toBe(
      "Zürich",
    );
    expect(titleFromPageUrl("https://en.wikipedia.org/w/api.php")).toBeUndefined();
  });
});
