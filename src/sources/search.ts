/** Title search for the search box (US-04): rest.php/v1/search/title. */
import type { Lang } from "../core/types.ts";
import { http, restUrl, type HttpClient } from "./http.ts";

export interface Suggestion {
  title: string;
  description?: string;
  thumbnail?: string;
}

export interface SearchResponse {
  pages: {
    title: string;
    description?: string | null;
    thumbnail?: { url: string } | null;
  }[];
}

export function parseSearch(data: SearchResponse): Suggestion[] {
  return data.pages.map((p) => {
    const s: Suggestion = { title: p.title };
    if (p.description) s.description = p.description;
    // Search returns protocol-relative thumbnail URLs ("//thumb.wikimedia.org/…").
    if (p.thumbnail?.url)
      s.thumbnail = p.thumbnail.url.startsWith("//") ? `https:${p.thumbnail.url}` : p.thumbnail.url;
    return s;
  });
}

export async function searchTitles(
  lang: Lang,
  query: string,
  options: { client?: HttpClient; signal?: AbortSignal; limit?: number } = {},
): Promise<Suggestion[]> {
  const url = `${restUrl(lang, "search/title")}?q=${encodeURIComponent(query)}&limit=${options.limit ?? 8}`;
  const { data } = await (options.client ?? http).getJson<SearchResponse>(
    url,
    options.signal ? { signal: options.signal } : {},
  );
  return parseSearch(data);
}
