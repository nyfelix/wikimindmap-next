/**
 * Wikipedia languages (US-09): every open Wikipedia from Wikimedia's site matrix, and the same
 * article in another language from langlinks.
 */
import type { Lang, Title } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

export interface Wikipedia {
  /** The subdomain: "en", "de", "be-tarask". */
  lang: Lang;
  /** The language's own name: "Deutsch". */
  name: string;
  /** The name in English: "German". */
  englishName: string;
}

export interface SitematrixResponse {
  sitematrix: Record<
    string,
    | number
    | {
        code: string;
        name: string;
        localname: string;
        site?: { url: string; code: string; closed?: boolean }[];
      }
  >;
}

/** Open Wikipedias only, sorted by their own name. */
export function parseSitematrix(data: SitematrixResponse): Wikipedia[] {
  const wikis: Wikipedia[] = [];
  for (const entry of Object.values(data.sitematrix)) {
    if (typeof entry !== "object") continue;
    const site = entry.site?.find((s) => s.code === "wiki" && !s.closed);
    if (!site) continue;
    const lang = new URL(site.url).hostname.split(".")[0];
    if (lang)
      wikis.push({ lang, name: entry.name || entry.localname, englishName: entry.localname });
  }
  return wikis.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadWikipedias(client: HttpClient = http): Promise<Wikipedia[]> {
  const { data } = await client.getJson<SitematrixResponse>(
    actionUrl(
      "meta",
      {
        action: "sitematrix",
        smtype: "language",
        smlangprop: "code|name|localname|site",
        smsiteprop: "url|code",
      },
      "meta.wikimedia.org",
    ),
  );
  return parseSitematrix(data);
}

export interface LanglinksResponse {
  query?: {
    pages?: { title: string; missing?: boolean; langlinks?: { lang: string; title: string }[] }[];
  };
}

/** The title of the same article on another Wikipedia, if it exists there. */
export async function langlink(
  lang: Lang,
  title: Title,
  target: Lang,
  client: HttpClient = http,
): Promise<Title | undefined> {
  const { data } = await client.getJson<LanglinksResponse>(
    actionUrl(lang, { prop: "langlinks", titles: title, lllang: target, redirects: 1 }),
  );
  return data.query?.pages?.[0]?.langlinks?.[0]?.title;
}
