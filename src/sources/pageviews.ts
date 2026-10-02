/**
 * Page views (TS-14): views in the last 30 days, `prop=pageviews&pvipdays=30`, 50 titles per
 * request. One response may fill only part of a batch: follow `pvipcontinue` (M0 spike).
 */
import { normalizeTitle } from "../core/titles.ts";
import type { Lang, Title } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

export const BATCH_SIZE = 50;

export interface PageviewsResponse {
  continue?: Record<string, string>;
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; pageviews?: Record<string, number | null> }[];
  };
}

/** Sums the daily values per page, and maps them back to the asked titles. */
export function sumPageviews(asked: Title[], responses: PageviewsResponse[]): Map<Title, number> {
  const resolve = new Map<Title, Title>();
  const views = new Map<Title, number>();
  for (const r of responses) {
    for (const n of r.query?.normalized ?? []) resolve.set(n.from, n.to);
    for (const d of r.query?.redirects ?? []) resolve.set(d.from, d.to);
    for (const page of r.query?.pages ?? []) {
      if (!page.pageviews) continue;
      const sum = Object.values(page.pageviews).reduce<number>((a, v) => a + (v ?? 0), 0);
      views.set(page.title, (views.get(page.title) ?? 0) + sum);
    }
  }
  const result = new Map<Title, number>();
  for (const title of asked) {
    let t = title;
    for (let i = 0; i < 2; i++) t = resolve.get(t) ?? t;
    const v = views.get(t);
    if (v !== undefined) result.set(title, v);
  }
  return result;
}

/** Raw responses per batch, continuation included (also what the fixture recorder stores). */
export async function fetchPageviews(
  lang: Lang,
  titles: Iterable<Title>,
  client: HttpClient = http,
) {
  const unique = [...new Set([...titles].map(normalizeTitle))].filter(Boolean);
  const batches: Title[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) batches.push(unique.slice(i, i + BATCH_SIZE));
  const responses = await Promise.all(
    batches.map(async (batch) => {
      const pages: PageviewsResponse[] = [];
      let cont: Record<string, string> = {};
      do {
        const { data } = await client.getJson<PageviewsResponse>(
          actionUrl(lang, {
            prop: "pageviews",
            pvipdays: 30,
            redirects: 1,
            titles: batch.join("|"),
            ...cont,
          }),
        );
        pages.push(data);
        cont = data.continue ?? {};
      } while (Object.keys(cont).length > 0);
      return pages;
    }),
  );
  return { titles: unique, responses: responses.flat() };
}

export async function loadPageviews(
  lang: Lang,
  titles: Iterable<Title>,
  client: HttpClient = http,
): Promise<Map<Title, number>> {
  const { titles: asked, responses } = await fetchPageviews(lang, titles, client);
  return sumPageviews(asked, responses);
}
