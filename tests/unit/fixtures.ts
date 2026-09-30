/** Reads recorded API responses from tests/fixtures (datamodel.md §9). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ArticleRef, Siteinfo } from "../../src/core/types.ts";
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
