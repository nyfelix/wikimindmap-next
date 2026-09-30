/**
 * Fallback when Parsoid HTML can't be parsed (architecture.md §4): the same Article shape from
 * `action=parse&prop=tocdata` and one `action=parse&section=N&prop=links` per section.
 *
 * This route can't tell where a link comes from, so `origin` is always `body`; it can't tell
 * redirects either, so every link is marked `redirect: true` and goes through the lookup.
 * Links come alphabetically, not in reading order.
 */
import { isHousekeeping } from "../core/housekeeping.ts";
import { normalizeTitle } from "../core/titles.ts";
import type { Article, ArticleRef, LinkOccurrence, Section } from "../core/types.ts";
import { actionUrl, http, type HttpClient } from "./http.ts";

export interface TocResponse {
  parse: {
    title: string;
    revid: number;
    displaytitle?: string;
    tocdata?: {
      sections: { hLevel: number; line: string; index: string; anchor: string }[];
    };
  };
}

export interface SectionLinksResponse {
  parse: { links: { ns: number; title: string; exists: boolean }[] };
}

export interface FallbackResponses {
  toc: TocResponse;
  /** Keyed by section index ("0" = lead). Each includes the links of its subsections. */
  links: Record<string, SectionLinksResponse>;
}

export function parseFallback(
  ref: ArticleRef,
  responses: FallbackResponses,
  options: { fetchedAt?: string } = {},
): Article {
  const { parse } = responses.toc;
  const title = normalizeTitle(parse.title);
  const lead = makeSection("0", 1, "", "", false);
  const sections: Section[] = [];
  const stack: Section[] = [];

  // Sections from other pages (index "T-1") are template-generated: their links stay with the
  // section that includes them, like negative Parsoid section IDs.
  for (const toc of parse.tocdata?.sections ?? []) {
    if (!/^\d+$/.test(toc.index)) continue;
    while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= toc.hLevel) stack.pop();
    const parent = stack.at(-1);
    const heading = stripHtml(toc.line);
    const housekeeping = (parent?.housekeeping ?? false) || isHousekeeping(ref.lang, heading);
    const section = makeSection(toc.index, toc.hLevel, heading, toc.anchor, housekeeping);
    (parent ? parent.children : sections).push(section);
    stack.push(section);
  }

  // A section's response includes its subsections; keep only the links not found below.
  let order = 0;
  const walk = (section: Section): Set<string> => {
    const below = new Set<string>();
    for (const child of section.children) for (const t of walk(child)) below.add(t);
    const all = linksOf(responses.links[String(section.id)], title);
    section.links = all.filter((l) => !below.has(l.target));
    return new Set([...below, ...all.map((l) => l.target)]);
  };
  walk(lead);
  sections.forEach(walk);
  // Number the links in section order (lead, then chapters depth-first).
  const number = (section: Section) => {
    for (const link of section.links) link.order = order++;
    section.children.forEach(number);
  };
  number(lead);
  sections.forEach(number);

  return {
    ref: { lang: ref.lang, title },
    displayTitle: stripHtml(parse.displaytitle ?? "") || title,
    revisionId: parse.revid,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    source: "fallback",
    lead,
    sections,
  };
}

/** Fetches everything parseFallback needs: one request for the sections, one per section. */
export async function loadFallback(
  ref: ArticleRef,
  client: HttpClient = http,
): Promise<FallbackResponses> {
  const { data: toc } = await client.getJson<TocResponse>(
    actionUrl(ref.lang, {
      action: "parse",
      page: ref.title,
      prop: "tocdata|revid|displaytitle",
      redirects: 1,
    }),
  );
  const indexes = [
    "0",
    ...(toc.parse.tocdata?.sections ?? []).map((s) => s.index).filter((i) => /^\d+$/.test(i)),
  ];
  // The client keeps at most 4 of these in flight.
  const results = await Promise.all(
    indexes.map((section) =>
      client.getJson<SectionLinksResponse>(
        actionUrl(ref.lang, { action: "parse", oldid: toc.parse.revid, section, prop: "links" }),
      ),
    ),
  );
  const links: Record<string, SectionLinksResponse> = {};
  indexes.forEach((index, i) => {
    const result = results[i];
    if (result) links[index] = result.data;
  });
  return { toc, links };
}

function linksOf(response: SectionLinksResponse | undefined, self: string): LinkOccurrence[] {
  return (response?.parse.links ?? [])
    .filter((l) => l.ns === 0 && normalizeTitle(l.title) !== self)
    .map((l) => {
      const target = normalizeTitle(l.title);
      return {
        target,
        text: target,
        order: 0,
        origin: "body",
        redLink: !l.exists,
        redirect: true,
      };
    });
}

function makeSection(
  index: string,
  level: number,
  title: string,
  anchor: string,
  housekeeping: boolean,
): Section {
  return { id: Number(index), level, title, anchor, housekeeping, links: [], children: [] };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Headings and display titles come as HTML; the Article holds plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X"))
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}
