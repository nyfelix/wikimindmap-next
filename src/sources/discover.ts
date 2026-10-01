/** Start-page links (US-04): today's featured article and a random article. */
import type { Lang, Title } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

export async function randomArticle(lang: Lang, client: HttpClient = http): Promise<Title> {
  const { data } = await client.getJson<{ query?: { random?: { title: string }[] } }>(
    actionUrl(lang, { list: "random", rnnamespace: 0, rnlimit: 1 }),
  );
  const title = data.query?.random?.[0]?.title;
  if (!title) throw new Error("No random article returned");
  return title;
}

/**
 * Today's featured article, from the REST feed. Not every wiki has one (the feed exists for
 * en, de, fr and some others); returns undefined then.
 */
export async function featuredArticle(
  lang: Lang,
  date: Date,
  client: HttpClient = http,
): Promise<Title | undefined> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  try {
    const { data } = await client.getJson<{
      tfa?: { titles?: { normalized?: string }; title?: string };
    }>(`https://${lang}.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`);
    return data.tfa?.titles?.normalized ?? data.tfa?.title?.replaceAll("_", " ");
  } catch {
    return undefined;
  }
}
