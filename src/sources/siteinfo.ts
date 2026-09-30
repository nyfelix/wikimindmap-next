import type { Lang, Siteinfo } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

/** The part of `meta=siteinfo&siprop=namespaces|namespacealiases` (formatversion 2) we read. */
export interface SiteinfoResponse {
  query: {
    namespaces: Record<string, { id: number; name: string; canonical?: string }>;
    namespacealiases?: { id: number; alias: string }[];
  };
}

/** Normalizes siteinfo: every local name, canonical name and alias maps to its namespace ID. */
export function parseSiteinfo(lang: Lang, response: SiteinfoResponse): Siteinfo {
  const namespaces: Record<string, number> = {};
  const add = (name: string | undefined, id: number) => {
    const key = name?.replaceAll("_", " ").trim().toLowerCase();
    if (key) namespaces[key] = id;
  };
  for (const ns of Object.values(response.query.namespaces)) {
    add(ns.name, ns.id);
    add(ns.canonical, ns.id);
  }
  for (const alias of response.query.namespacealiases ?? []) add(alias.alias, alias.id);
  return { lang, namespaces };
}

export async function loadSiteinfo(lang: Lang, client: HttpClient = http): Promise<Siteinfo> {
  const url = actionUrl(lang, { meta: "siteinfo", siprop: "namespaces|namespacealiases" });
  const { data } = await client.getJson<SiteinfoResponse>(url);
  return parseSiteinfo(lang, data);
}
