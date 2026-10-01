/**
 * Preview-card summaries (US-06) from the Action API (decided in the M0 spike,
 * architecture.md §13): short description, plain-text lead and thumbnail.
 */
import { normalizeTitle } from "../core/titles.ts";
import type { Lang, Summary, Title } from "../core/types.ts";
import { actionUrl, http, NotFound, type HttpClient } from "./http.ts";

export interface SummaryResponse {
  query?: {
    pages?: {
      title: string;
      missing?: boolean;
      description?: string;
      extract?: string;
      thumbnail?: { source: string; width: number; height: number };
    }[];
  };
}

export function parseSummary(data: SummaryResponse): Summary | undefined {
  const page = data.query?.pages?.[0];
  if (!page || page.missing) return undefined;
  const summary: Summary = {
    title: normalizeTitle(page.title),
    extract: (page.extract ?? "").trim(),
  };
  if (page.description) summary.description = page.description;
  if (page.thumbnail) {
    summary.thumbnail = {
      url: page.thumbnail.source,
      width: page.thumbnail.width,
      height: page.thumbnail.height,
    };
  }
  return summary;
}

export async function loadSummary(
  lang: Lang,
  title: Title,
  client: HttpClient = http,
): Promise<Summary> {
  const url = actionUrl(lang, {
    prop: "extracts|pageimages|description",
    exintro: 1,
    explaintext: 1,
    exsentences: 3,
    piprop: "thumbnail",
    pithumbsize: 320,
    redirects: 1,
    titles: title,
  });
  const { data } = await client.getJson<SummaryResponse>(url);
  const summary = parseSummary(data);
  if (!summary) throw new NotFound(url);
  return summary;
}
