/** Reads recorded API responses from tests/fixtures (datamodel.md §9). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Article, ArticleRef, Siteinfo } from "../../src/core/types.ts";
import { redirectPairs, type RedirectsResponse } from "../../src/sources/redirects.ts";
import { parseSiteinfo, type SiteinfoResponse } from "../../src/sources/siteinfo.ts";

export const FIXTURES = join(import.meta.dirname, "..", "fixtures");

export interface Fixture {
  ref: ArticleRef;
  dir: string;
}

/** Every recorded article, sorted by language and title. */
export function allFixtures(): Fixture[] {
  return readdirSync(FIXTURES)
    .filter((lang) => statSync(join(FIXTURES, lang)).isDirectory())
    .sort()
    .flatMap((lang) =>
      readdirSync(join(FIXTURES, lang))
        .filter((name) => statSync(join(FIXTURES, lang, name)).isDirectory())
        .sort()
        .map((name) => ({
          ref: { lang, title: name.replaceAll("_", " ") },
          dir: join(FIXTURES, lang, name),
        })),
    );
}

export function fixture(lang: string, title: string): Fixture {
  return { ref: { lang, title }, dir: join(FIXTURES, lang, title.replaceAll(" ", "_")) };
}

export function readText(f: Fixture, file: string): string {
  return readFileSync(join(f.dir, file), "utf8");
}

export function readJson<T>(f: Fixture, file: string): T {
  return JSON.parse(readText(f, file)) as T;
}

const siteinfoCache = new Map<string, Siteinfo>();

export function siteinfo(lang: string): Siteinfo {
  let info = siteinfoCache.get(lang);
  if (!info) {
    const raw = JSON.parse(readFileSync(join(FIXTURES, lang, "siteinfo.json"), "utf8"));
    info = parseSiteinfo(lang, raw as SiteinfoResponse);
    siteinfoCache.set(lang, info);
  }
  return info;
}

const articleCache = new Map<string, Article>();

/** Where globalSetup.ts caches the parsed Article of a fixture. */
export function articleCachePath(f: Fixture): string {
  const name = `${f.ref.lang}-${f.ref.title.replaceAll(" ", "_")}.json`;
  return join(FIXTURES, "..", "..", "node_modules", ".cache", "wmm-articles", name);
}

/** The parsed Article of a fixture, from the cache that globalSetup.ts fills before the tests. */
export function fixtureArticle(f: Fixture): Article {
  let article = articleCache.get(f.dir);
  if (!article) {
    article = (JSON.parse(readFileSync(articleCachePath(f), "utf8")) as { article: Article })
      .article;
    articleCache.set(f.dir, article);
  }
  return article;
}

/** The recorded redirects of a fixture as the map the lenses take. */
export function fixtureRedirects(f: Fixture): Map<string, string> {
  const map = new Map<string, string>();
  for (const batch of readJson<RedirectsResponse[]>(f, "redirects.json")) {
    const titles = [
      ...(batch.query?.normalized ?? []).map((n) => n.from),
      ...(batch.query?.redirects ?? []).map((r) => r.from),
    ];
    for (const [from, to] of redirectPairs(titles, batch)) map.set(from, to);
  }
  return map;
}
