/**
 * Kinds (TS-14): Wikidata item per title (`prop=pageprops&ppprop=wikibase_item`, 50 per
 * request), then "instance of" (P31) per item from the Wikidata query service, P31 only
 * (owner decision: wbgetentities returns every statement, ~4 MB per 50 items).
 */
import { normalizeTitle } from "../core/titles.ts";
import type { Kind, KindInfo, Lang, Title } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

export const BATCH_SIZE = 50;
export const SPARQL_URL = "https://query.wikidata.org/sparql";

export interface PagepropsResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; pageprops?: { wikibase_item?: string } }[];
  };
}

export interface SparqlResponse {
  results: { bindings: { item: { value: string }; class: { value: string } }[] };
}

/** QID of each asked title (after normalization and redirects). */
export function qidsFrom(asked: Title[], responses: PagepropsResponse[]): Map<Title, string> {
  const resolve = new Map<Title, Title>();
  const qid = new Map<Title, string>();
  for (const r of responses) {
    for (const n of r.query?.normalized ?? []) resolve.set(n.from, n.to);
    for (const d of r.query?.redirects ?? []) resolve.set(d.from, d.to);
    for (const p of r.query?.pages ?? [])
      if (p.pageprops?.wikibase_item) qid.set(p.title, p.pageprops.wikibase_item);
  }
  const result = new Map<Title, string>();
  for (const title of asked) {
    let t = title;
    for (let i = 0; i < 2; i++) t = resolve.get(t) ?? t;
    const q = qid.get(t);
    if (q) result.set(title, q);
  }
  return result;
}

const qidOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

/** P31 classes per item. */
export function classesFrom(responses: SparqlResponse[]): Map<string, string[]> {
  const classes = new Map<string, string[]>();
  for (const r of responses) {
    for (const b of r.results.bindings) {
      const item = qidOf(b.item.value);
      const list = classes.get(item) ?? [];
      list.push(qidOf(b.class.value));
      classes.set(item, list);
    }
  }
  return classes;
}

export function p31Query(qids: string[]): string {
  return `SELECT ?item ?class WHERE { VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} } ?item wdt:P31 ?class }`;
}

const batchesOf = <T>(items: T[]) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) out.push(items.slice(i, i + BATCH_SIZE));
  return out;
};

/** Raw responses (also what the fixture recorder stores). */
export async function fetchWikidata(
  lang: Lang,
  titles: Iterable<Title>,
  client: HttpClient = http,
) {
  const asked = [...new Set([...titles].map(normalizeTitle))].filter(Boolean);
  const pageprops = await Promise.all(
    batchesOf(asked).map(
      async (batch) =>
        (
          await client.getJson<PagepropsResponse>(
            actionUrl(lang, {
              prop: "pageprops",
              ppprop: "wikibase_item",
              redirects: 1,
              titles: batch.join("|"),
            }),
          )
        ).data,
    ),
  );
  const qids = qidsFrom(asked, pageprops);
  const sparql = await Promise.all(
    batchesOf([...new Set(qids.values())]).map(
      async (batch) =>
        (
          await client.getJson<SparqlResponse>(
            `${SPARQL_URL}?format=json&query=${encodeURIComponent(p31Query(batch))}`,
          )
        ).data,
    ),
  );
  return { titles: asked, pageprops, sparql };
}

/** When an item has several known classes, the first kind in this order wins. */
export const KIND_PRECEDENCE: Kind[] = ["people", "places", "orgs", "works", "events", "concepts"];

/** A class → kind table (lenses/kindMap.json): [kind, English label]. */
export type KindMap = Record<string, [Kind, string]>;

/** The kind of each title: the first P31 class found in the kind map, else "concepts". */
export function kindsFrom(
  data: Awaited<ReturnType<typeof fetchWikidata>>,
  kindMap: KindMap,
): Map<Title, KindInfo> {
  const qids = qidsFrom(data.titles, data.pageprops);
  const classes = classesFrom(data.sparql);
  const result = new Map<Title, KindInfo>();
  for (const title of data.titles) {
    const qid = qids.get(title);
    const p31 = qid ? (classes.get(qid) ?? []) : [];
    const known = p31
      .map((c) => kindMap[c])
      .filter((k): k is [Kind, string] => k !== undefined)
      .sort((a, b) => KIND_PRECEDENCE.indexOf(a[0]) - KIND_PRECEDENCE.indexOf(b[0]));
    const info: KindInfo = {
      instanceOf: known.map(([, label]) => label),
      kind: known[0]?.[0] ?? "concepts",
    };
    if (qid) info.qid = qid;
    result.set(title, info);
  }
  return result;
}
