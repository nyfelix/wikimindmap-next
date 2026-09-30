import { Window } from "happy-dom";
import { describe, expect, it, vi } from "vitest";
import type { Article, LinkOccurrence, Section } from "../../src/core/types.ts";
import { compareVersions, parseParsoid, ParsoidError } from "../../src/sources/parsoid.ts";
import { allFixtures, fixture, readText, siteinfo, type Fixture } from "./fixtures.ts";

const FETCHED_AT = "2026-09-30T00:00:00.000Z";
const parser = new DOMParser();
const parsed = new Map<string, Article>();

/**
 * Parses each fixture once, with its own happy-dom window that is closed afterwards:
 * happy-dom keeps documents alive otherwise, and 12 MB of fixtures exhaust the heap.
 */
function parse(f: Fixture): Article {
  let article = parsed.get(f.dir);
  if (!article) {
    article = parseFresh(f);
    parsed.set(f.dir, article);
  }
  return article;
}

function parseFresh(f: Fixture, warn = vi.fn()): Article {
  const window = new Window();
  try {
    return parseParsoid(
      readText(f, "page.html"),
      f.ref,
      siteinfo(f.ref.lang),
      new window.DOMParser() as unknown as DOMParser,
      { fetchedAt: FETCHED_AT, warn },
    );
  } finally {
    void window.happyDOM.close();
  }
}

function allSections(article: Article): Section[] {
  const walk = (s: Section): Section[] => [s, ...s.children.flatMap(walk)];
  return [article.lead, ...article.sections.flatMap(walk)];
}

function allLinks(article: Article): LinkOccurrence[] {
  return allSections(article).flatMap((s) => s.links);
}

/** A compact, readable outline: one line per section with link counts by origin. */
function outline(article: Article): string {
  const lines = [
    `${article.displayTitle} · rev ${article.revisionId} · spec ${article.parserSpecVersion}`,
  ];
  const describe = (s: Section, depth: number) => {
    const byOrigin: Record<string, number> = {};
    for (const l of s.links) byOrigin[l.origin] = (byOrigin[l.origin] ?? 0) + 1;
    const counts = Object.entries(byOrigin)
      .sort()
      .map(([o, n]) => `${o} ${n}`)
      .join(", ");
    const first = s.links
      .filter((l) => l.origin === "body")
      .slice(0, 3)
      .map((l) => l.target)
      .join(" | ");
    const name = s.id === 0 ? "(lead)" : `h${s.level} ${s.title}`;
    lines.push(
      `${"  ".repeat(depth)}${name}${s.housekeeping ? " [hk]" : ""} — ${counts || "no links"}${first ? ` — ${first}` : ""}`,
    );
    s.children.forEach((c) => describe(c, depth + 1));
  };
  describe(article.lead, 0);
  article.sections.forEach((s) => describe(s, 0));
  return lines.join("\n");
}

describe("parseParsoid on every starter fixture", () => {
  for (const f of allFixtures()) {
    it(`${f.ref.lang}:${f.ref.title}`, () => {
      const article = parse(f);
      expect(outline(article)).toMatchSnapshot();

      const links = allLinks(article);
      expect(links.length).toBeGreaterThan(0);
      // Reading order is global and gap-free.
      expect(links.map((l) => l.order).sort((a, b) => a - b)).toEqual(links.map((_, i) => i));
      for (const link of links) {
        expect(link.target).not.toBe(article.ref.title);
        expect(link.target).not.toMatch(/^(File|Datei|Fichier|Category|Kategorie|Catégorie):/);
        if (link.origin === "body") expect(link.template).toBeUndefined();
      }
    });
  }
});

describe("parseParsoid on Mind map (en)", () => {
  const article = parse(fixture("en", "Mind map"));
  const links = allLinks(article);

  it("reads title, revision and spec version", () => {
    expect(article.ref).toEqual({ lang: "en", title: "Mind map" });
    expect(article.displayTitle).toBe("Mind map");
    expect(article.revisionId).toBe(1374343935);
    expect(article.parserSpecVersion).toBe("2.8.0");
    expect(article.source).toBe("parsoid");
    expect(article.fetchedAt).toBe(FETCHED_AT);
  });

  // The story says "History"; the recorded revision calls that chapter "Origin".
  it('has a section "Origin"', () => {
    const origin = article.sections.find((s) => s.title === "Origin");
    expect(origin).toMatchObject({ level: 2, anchor: "Origin", housekeeping: false });
  });

  it("links to Tony Buzan in body text", () => {
    expect(links.some((l) => l.target === "Tony Buzan" && l.origin === "body")).toBe(true);
  });

  it("marks navbox links as navbox", () => {
    const navbox = links.filter((l) => l.origin === "navbox");
    expect(navbox.length).toBeGreaterThan(10);
    expect(navbox.map((l) => l.target)).toContain("Brainstorming");
  });

  it("marks the {{About}} hatnote in the lead", () => {
    expect(article.lead.links[0]).toMatchObject({
      target: "Mental mapping",
      origin: "hatnote",
      template: "About",
    });
  });

  it("flags links to redirect pages", () => {
    const link = links.find((l) => l.target === "Knowledge visualization");
    expect(link?.redirect).toBe(true);
    expect(links.find((l) => l.target === "Tony Buzan")?.redirect).toBe(false);
  });

  it("marks housekeeping chapters", () => {
    const titles = article.sections.filter((s) => s.housekeeping).map((s) => s.title);
    expect(titles).toEqual(expect.arrayContaining(["See also", "References"]));
  });
});

describe("parseParsoid on World War II (en)", () => {
  const f = fixture("en", "World War II");

  it("nests subchapters as children with their level", () => {
    const article = parse(f);
    const background = article.sections.find((s) => s.title === "Background");
    expect(background?.level).toBe(2);
    expect(background?.children[0]).toMatchObject({ title: "Aftermath of World War I", level: 3 });
  });

  it("keeps fragments", () => {
    const article = parse(f);
    expect(allLinks(article)).toContainEqual(
      expect.objectContaining({
        target: "Western Front (World War II)",
        fragment: "1939–1940: Axis victories",
      }),
    );
  });

  it("marks infobox and reference links", () => {
    const origins = new Set(allLinks(parse(f)).map((l) => l.origin));
    expect(origins).toEqual(
      new Set(["body", "hatnote", "infobox", "navbox", "reference", "template"]),
    );
  });
});

describe("parseParsoid edge cases", () => {
  const info = siteinfo("en");
  const ref = { lang: "en", title: "Sample" };
  const page = (body: string, version = "2.8.0") =>
    `<!DOCTYPE html><html about="//en.wikipedia.org/wiki/Special:Redirect/revision/42"><head>` +
    `<meta property="mw:htmlVersion" content="${version}"/><title>Sample</title></head>` +
    `<body><section data-mw-section-id="0">${body}</section></body></html>`;

  it("flags red links and drops their query", () => {
    const article = parseParsoid(
      page(
        `<p><a rel="mw:WikiLink" href="./Mindnode?action=edit&amp;redlink=1" class="new">Mindnode</a></p>`,
      ),
      ref,
      info,
      parser,
    );
    expect(article.lead.links[0]).toMatchObject({ target: "Mindnode", redLink: true });
  });

  it("skips self-links, other namespaces and duplicates at the same position", () => {
    const article = parseParsoid(
      page(
        `<p><a rel="mw:WikiLink" href="./Sample#cite_note-1">1</a>` +
          `<a rel="mw:WikiLink" href="./File:X.png">x</a>` +
          `<a rel="mw:WikiLink" href="./Chess">Chess</a><a rel="mw:WikiLink" href="./Chess">Chess</a>` +
          ` and <a rel="mw:WikiLink" href="./Chess">chess</a></p>`,
      ),
      ref,
      info,
      parser,
    );
    expect(article.lead.links.map((l) => [l.target, l.text, l.order])).toEqual([
      ["Chess", "Chess", 0],
      ["Chess", "chess", 1],
    ]);
  });

  it("merges negative pseudo sections into their parent", () => {
    const html =
      `<!DOCTYPE html><html><head><title>Sample</title></head><body>` +
      `<section data-mw-section-id="0"></section>` +
      `<section data-mw-section-id="1"><h2 id="A">A</h2><p><a rel="mw:WikiLink" href="./One">1</a></p>` +
      `<section data-mw-section-id="-1"><h3>Generated</h3><p><a rel="mw:WikiLink" href="./Two">2</a></p>` +
      `<section data-mw-section-id="2"><h3 id="B">B</h3></section></section></section></body></html>`;
    const article = parseParsoid(html, ref, info, parser);
    expect(article.sections).toHaveLength(1);
    const a = article.sections[0]!;
    expect(a.links.map((l) => l.target)).toEqual(["One", "Two"]);
    expect(a.children.map((c) => c.title)).toEqual(["B"]);
  });

  it("warns when the spec version is newer than tested", () => {
    const warn = vi.fn();
    parseParsoid(page("", "2.9.0"), ref, info, parser, { warn });
    expect(warn).toHaveBeenCalledOnce();
    parseParsoid(page("", "2.8.0"), ref, info, parser, { warn });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("throws a ParsoidError for HTML without sections", () => {
    expect(() => parseParsoid("<html><body><p>hi</p></body></html>", ref, info, parser)).toThrow(
      ParsoidError,
    );
  });

  it("compares versions numerically", () => {
    expect(compareVersions("2.10.0", "2.8.0")).toBe(1);
    expect(compareVersions("2.8.0", "2.8.0")).toBe(0);
    expect(compareVersions("2.7.9", "2.8.0")).toBe(-1);
  });
});
