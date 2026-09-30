/**
 * Redirect resolution (architecture.md §4): `action=query&redirects=1`, 50 titles per request.
 * Only needed for links Parsoid marks as redirects (`LinkOccurrence.redirect`).
 */
import { normalizeTitle } from "../core/titles.ts";
import type { Lang, Title } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

export const BATCH_SIZE = 50;

export interface RedirectsResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string; tofragment?: string }[];
  };
}

/** Maps every title that isn't canonical to its target; titles that stay the same are left out. */
export async function resolveRedirects(
  lang: Lang,
  titles: Iterable<Title>,
  client: HttpClient = http,
): Promise<Map<Title, Title>> {
  const unique = [...new Set([...titles].map(normalizeTitle).filter(Boolean))];
  const batches: Title[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) batches.push(unique.slice(i, i + BATCH_SIZE));

  // The client keeps at most 4 batches in flight.
  const responses = await Promise.all(
    batches.map((batch) =>
      client.getJson<RedirectsResponse>(actionUrl(lang, { redirects: 1, titles: batch.join("|") })),
    ),
  );
  const result = new Map<Title, Title>();
  responses.forEach((response, i) => {
    for (const [from, to] of redirectPairs(batches[i] ?? [], response.data)) result.set(from, to);
  });
  return result;
}

/** Applies `normalized`, then `redirects`, to each requested title. */
export function redirectPairs(requested: Title[], data: RedirectsResponse): [Title, Title][] {
  const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.from, n.to]));
  const redirects = new Map((data.query?.redirects ?? []).map((r) => [r.from, r.to]));
  const pairs: [Title, Title][] = [];
  for (const title of requested) {
    const canonical = normalized.get(title) ?? title;
    const target = redirects.get(canonical) ?? canonical;
    if (target !== title) pairs.push([title, target]);
  }
  return pairs;
}
