/**
 * Links back (TS-16): which leaves link back to the center, for the direction symbols (US-17).
 *
 *   action=query&prop=links&titles=A|B|…&pltitles={center}|{its redirects}&pllimit=max&redirects=1
 *
 * Many articles link to the center through a redirect ("Mind-map" for "Mind map"), so the
 * center's redirects are part of pltitles. Leaf titles that are redirects are resolved by the
 * API (redirects=1) and mapped back to the title that was asked. 50 titles per request,
 * following plcontinue.
 */
import { normalizeTitle } from "../core/titles.ts";
import type { Lang, Title } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

export const BATCH_SIZE = 50;
/** pltitles takes at most 50 titles: the center and 49 of its redirects. */
const MAX_TARGETS = 50;

export interface LinksResponse {
  continue?: Record<string, string>;
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; links?: { ns: number; title: string }[] }[];
  };
}

export interface CenterRedirectsResponse {
  continue?: Record<string, string>;
  query?: { pages?: { title: string; redirects?: { title: string }[] }[] };
}

/** The titles that redirect to the center (namespace 0), so links through them count. */
export async function centerRedirects(
  lang: Lang,
  center: Title,
  client: HttpClient = http,
): Promise<Title[]> {
  const titles: Title[] = [];
  let cont: Record<string, string> = {};
  do {
    const { data } = await client.getJson<CenterRedirectsResponse>(
      actionUrl(lang, {
        prop: "redirects",
        titles: center,
        rdnamespace: 0,
        rdlimit: "max",
        rdprop: "title",
        ...cont,
      }),
    );
    for (const page of data.query?.pages ?? []) {
      for (const r of page.redirects ?? []) titles.push(r.title);
    }
    cont = data.continue ?? {};
  } while (Object.keys(cont).length > 0 && titles.length < MAX_TARGETS);
  return titles;
}

/**
 * Returns the asked titles (and their resolved titles) that link to the center. `aliases` are
 * the center's redirects (see centerRedirects).
 */
export async function linksBack(
  lang: Lang,
  center: Title,
  titles: Iterable<Title>,
  options: { client?: HttpClient; aliases?: Title[] } = {},
): Promise<Set<Title>> {
  const client = options.client ?? http;
  const targets = [center, ...(options.aliases ?? []).filter((a) => a !== center)].slice(
    0,
    MAX_TARGETS,
  );
  const unique = [...new Set([...titles].map(normalizeTitle))].filter((t) => t && t !== center);
  const batches: Title[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) batches.push(unique.slice(i, i + BATCH_SIZE));

  const back = new Set<Title>();
  // The client keeps at most 4 batches in flight.
  await Promise.all(
    batches.map(async (batch) => {
      const linking = new Set<Title>();
      const resolve = new Map<Title, Title>();
      let cont: Record<string, string> = {};
      do {
        const { data } = await client.getJson<LinksResponse>(
          actionUrl(lang, {
            prop: "links",
            titles: batch.join("|"),
            pltitles: targets.join("|"),
            pllimit: "max",
            redirects: 1,
            ...cont,
          }),
        );
        for (const n of data.query?.normalized ?? []) resolve.set(n.from, n.to);
        for (const r of data.query?.redirects ?? []) resolve.set(r.from, r.to);
        for (const page of data.query?.pages ?? []) {
          if ((page.links ?? []).length > 0) linking.add(page.title);
        }
        cont = data.continue ?? {};
      } while (Object.keys(cont).length > 0);

      for (const asked of batch) {
        let title = asked;
        // Follow normalization, then the redirect (at most two steps).
        for (let i = 0; i < 2; i++) title = resolve.get(title) ?? title;
        if (linking.has(title)) {
          back.add(asked);
          back.add(title);
        }
      }
    }),
  );
  return back;
}
