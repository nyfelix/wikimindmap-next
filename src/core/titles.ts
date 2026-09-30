/**
 * Title rules (datamodel.md §1): URLs use `_` and percent-encoding, the app uses spaces.
 */
import type { Siteinfo, Title } from "./types.ts";

/** Title → URL path segment: `Zürich` → `Z%C3%BCrich`, `Mind map` → `Mind_map`. */
export function titleToPath(title: Title): string {
  return encodeURIComponent(title.replaceAll(" ", "_"));
}

/** URL path segment → title: `Z%C3%BCrich` → `Zürich`, `Mind_map` → `Mind map`. */
export function titleFromPath(segment: string): Title {
  return normalizeTitle(safeDecode(segment));
}

/**
 * Canonical form: underscores become spaces, whitespace is collapsed, and the first letter is
 * upper-cased (all Wikipedias use first-letter case).
 */
export function normalizeTitle(raw: string): Title {
  const title = raw.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  if (!title) return "";
  const first = String.fromCodePoint(title.codePointAt(0) ?? 0);
  const upper = first.toUpperCase();
  // MediaWiki keeps letters whose capital is longer (ß → "SS").
  return upper.length === first.length ? upper + title.slice(first.length) : title;
}

export interface HrefTarget {
  target: Title;
  fragment?: string;
}

/**
 * Parsoid link href → target and fragment.
 * `./Tony_Buzan#Early_life` → `{ target: "Tony Buzan", fragment: "Early life" }`.
 * Red links carry a query (`./Mindnode?action=edit&redlink=1`), which is dropped; a `?` inside
 * a title is always encoded as `%3F`. Returns undefined for anything that isn't `./…`.
 */
export function parseHref(href: string): HrefTarget | undefined {
  if (!href.startsWith("./")) return undefined;
  const rest = href.slice(2);
  const hash = rest.indexOf("#");
  const path = hash === -1 ? rest : rest.slice(0, hash);
  const query = path.indexOf("?");
  const target = normalizeTitle(safeDecode(query === -1 ? path : path.slice(0, query)));
  if (!target) return undefined;
  if (hash === -1) return { target };
  const fragment = safeDecode(rest.slice(hash + 1))
    .replaceAll("_", " ")
    .trim();
  return fragment ? { target, fragment } : { target };
}

/** Namespace ID of a title; 0 (articles) unless the prefix is a known namespace name or alias. */
export function namespaceOf(title: Title, siteinfo: Siteinfo): number {
  const colon = title.indexOf(":");
  if (colon <= 0) return 0;
  const prefix = title.slice(0, colon).replaceAll("_", " ").trim().toLowerCase();
  return siteinfo.namespaces[prefix] ?? 0;
}

/** True for titles in the article namespace. */
export function isArticle(title: Title, siteinfo: Siteinfo): boolean {
  return namespaceOf(title, siteinfo) === 0;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A stray "%" that isn't an escape: keep the text as it is.
    return value;
  }
}
