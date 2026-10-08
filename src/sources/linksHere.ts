/**
 * Incoming links (TS-15): the articles that link to the center, for the Links in / out lens.
 *
 *   action=query&generator=backlinks&gbltitle={center}&gblnamespace=0&gblfilterredir=nonredirects
 *     &gblredirect=1&gbllimit=500&prop=info
 *
 * `gblredirect=1` also lists pages that link through one of the center's redirects ("Mind-map"),
 * and the redirect pages themselves, which are dropped (prop=info flags them). A page that links
 * both directly and through a redirect is listed twice. prop=info gives each page's length for
 * free: page views for 2,000 titles would take 100+ requests and meet HTTP 429 (M6 spike), so
 * the list is ordered longest first and only the first CANDIDATES get page views.
 */
import { normalizeTitle } from "../core/titles.ts";
import type { Lang, LinksHere, Title } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

/** Count incoming links up to this many; beyond it the total shows as "2,000+". */
export const CAP = 2000;
/** The longest linking articles that get page views, to rank the side by views. */
export const CANDIDATES = 100;

export interface BacklinksResponse {
  continue?: Record<string, string>;
  query?: {
    pages?: {
      title: string;
      ns?: number;
      redirect?: boolean;
      length?: number;
      missing?: boolean;
    }[];
  };
}

/** Raw responses (also what the fixture recorder stores), and whether more pages remained. */
export interface BacklinksPages {
  center: Title;
  responses: BacklinksResponse[];
  more: boolean;
}

/** Linking articles from raw responses: no redirects, no duplicates, longest first. */
export function parseLinksHere({ center, responses, more }: BacklinksPages, cap = CAP): LinksHere {
  const length = new Map<Title, number>();
  for (const r of responses) {
    for (const page of r.query?.pages ?? []) {
      if (page.redirect || page.missing || (page.ns ?? 0) !== 0 || page.title === center) continue;
      length.set(page.title, Math.max(length.get(page.title) ?? 0, page.length ?? 0));
    }
  }
  const titles = [...length.keys()].sort(
    (a, b) => (length.get(b) ?? 0) - (length.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0),
  );
  const capped = more || titles.length > cap;
  return { titles: titles.slice(0, cap), total: Math.min(titles.length, cap), capped };
}

export async function fetchLinksHere(
  lang: Lang,
  center: Title,
  client: HttpClient = http,
  cap = CAP,
): Promise<BacklinksPages> {
  const title = normalizeTitle(center);
  const responses: BacklinksResponse[] = [];
  const seen = new Set<Title>();
  let cont: Record<string, string> = {};
  do {
    const { data } = await client.getJson<BacklinksResponse>(
      actionUrl(lang, {
        generator: "backlinks",
        gbltitle: title,
        gblnamespace: 0,
        gblfilterredir: "nonredirects",
        gblredirect: 1,
        gbllimit: 500,
        prop: "info",
        ...cont,
      }),
    );
    responses.push(data);
    for (const page of data.query?.pages ?? []) if (!page.redirect) seen.add(page.title);
    cont = data.continue ?? {};
  } while (Object.keys(cont).length > 0 && seen.size <= cap);
  return { center: title, responses, more: Object.keys(cont).length > 0 };
}

export async function loadLinksHere(
  lang: Lang,
  center: Title,
  client: HttpClient = http,
): Promise<LinksHere> {
  return parseLinksHere(await fetchLinksHere(lang, center, client));
}
