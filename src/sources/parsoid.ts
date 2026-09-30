/**
 * Parsoid HTML → Article (datamodel.md §2). The only module that knows the Parsoid format.
 * The DOMParser is passed in, so this stays testable and free of DOM globals.
 */
import { isHousekeeping } from "../core/housekeeping.ts";
import { isArticle, normalizeTitle, parseHref } from "../core/titles.ts";
import type {
  Article,
  ArticleRef,
  LinkOccurrence,
  LinkOrigin,
  Section,
  Siteinfo,
} from "../core/types.ts";

/** The MediaWiki DOM Spec version the parser was tested against. */
export const TESTED_SPEC_VERSION = "2.8.0";

export interface DomParserLike {
  parseFromString(html: string, type: "text/html"): Document;
}

export interface ParseOptions {
  /** ISO timestamp; defaults to now. Fixed in tests so results are deterministic. */
  fetchedAt?: string;
  /** Called when the HTML is newer than TESTED_SPEC_VERSION. Defaults to console.warn. */
  warn?: (message: string) => void;
}

export class ParsoidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParsoidError";
  }
}

/** Marker classes per origin. Wikis differ: de uses its own names for hatnotes and navboxes. */
const MARKERS: [LinkOrigin, string[]][] = [
  ["hatnote", ["hatnote", "vorlage-weiterleitungshinweis"]],
  ["navbox", ["navbox", "navileiste"]],
  ["infobox", ["infobox"]],
  ["reference", ["mw-ref", "mw-references", "references", "mw-reference-text", "reference"]],
];

export function parseParsoid(
  html: string,
  ref: ArticleRef,
  siteinfo: Siteinfo,
  domParser: DomParserLike,
  options: ParseOptions = {},
): Article {
  const doc = domParser.parseFromString(html, "text/html");
  const body = doc.body as HTMLElement | null;
  const root = body?.querySelector('section[data-mw-section-id="0"]')?.parentElement;
  if (!body || !root) throw new ParsoidError(`No Parsoid sections in the HTML for ${ref.title}`);

  const specVersion =
    doc.querySelector('meta[property="mw:htmlVersion"]')?.getAttribute("content") ??
    body.getAttribute("data-mw-html-version") ??
    undefined;
  if (specVersion && compareVersions(specVersion, TESTED_SPEC_VERSION) > 0) {
    (options.warn ?? console.warn)(
      `Parsoid HTML ${specVersion} is newer than the tested ${TESTED_SPEC_VERSION} (${ref.lang}:${ref.title})`,
    );
  }

  // Sections first, so links can be attached to them by element.
  const sectionOf = new Map<Element, Section>();
  const lead = makeSection(0, 1, "", "", false);
  const sections: Section[] = [];
  collectSections(root, lead, sections, 1, false);

  function collectSections(
    parent: Element,
    parentSection: Section,
    into: Section[],
    parentLevel: number,
    parentHousekeeping: boolean,
  ) {
    for (const el of Array.from(parent.children)) {
      if (el.tagName !== "SECTION" || !el.hasAttribute("data-mw-section-id")) continue;
      const id = Number(el.getAttribute("data-mw-section-id"));
      if (id === 0) {
        sectionOf.set(el, lead);
        continue;
      }
      if (id < 0) {
        // Template-generated pseudo section: its content belongs to the parent.
        sectionOf.set(el, parentSection);
        collectSections(el, parentSection, into, parentLevel, parentHousekeeping);
        continue;
      }
      const heading = headingOf(el);
      const title = heading ? plainText(heading) : "";
      const level = heading ? Number(heading.tagName.slice(1)) : parentLevel + 1;
      const housekeeping = parentHousekeeping || isHousekeeping(ref.lang, title);
      const section = makeSection(id, level, title, heading?.id ?? "", housekeeping);
      sectionOf.set(el, section);
      into.push(section);
      collectSections(el, section, section.children, level, housekeeping);
    }
  }

  const originOf = createOriginFinder(transclusionsOf(doc), body);
  const self = normalizeTitle(ref.title);
  let order = 0;
  let previous: { target: string; text: string; parent: Element | null } | undefined;

  for (const a of Array.from(body.querySelectorAll('a[rel~="mw:WikiLink"]'))) {
    const parsed = parseHref(a.getAttribute("href") ?? "");
    if (!parsed || parsed.target === self || !isArticle(parsed.target, siteinfo)) continue;

    const text = plainText(a) || parsed.target;
    // Parsoid can emit the same link twice in one place (e.g. an image link and its caption).
    if (
      previous &&
      previous.target === parsed.target &&
      previous.text === text &&
      previous.parent === a.parentElement
    ) {
      continue;
    }
    previous = { target: parsed.target, text, parent: a.parentElement };

    const { origin, template } = originOf(a, parsed.target);
    const link: LinkOccurrence = {
      target: parsed.target,
      text,
      order: order++,
      origin,
      redLink: a.classList.contains("new") || (a.getAttribute("href") ?? "").includes("redlink=1"),
      redirect: a.classList.contains("mw-redirect"),
    };
    if (parsed.fragment) link.fragment = parsed.fragment;
    if (template && origin !== "body") link.template = template;
    sectionFor(a, sectionOf, lead).links.push(link);
  }

  return {
    ref: { lang: ref.lang, title: self },
    displayTitle: plainText(doc.querySelector("head > title")) || self,
    revisionId: revisionOf(doc),
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    ...(specVersion ? { parserSpecVersion: specVersion } : {}),
    source: "parsoid",
    lead,
    sections,
  };
}

function makeSection(
  id: number,
  level: number,
  title: string,
  anchor: string,
  housekeeping: boolean,
): Section {
  return { id, level, title, anchor, housekeeping, links: [], children: [] };
}

/** The first child heading, also inside a `div.mw-heading` wrapper (used by newer skins). */
function headingOf(section: Element): Element | undefined {
  for (const child of Array.from(section.children)) {
    if (/^H[2-6]$/.test(child.tagName)) return child;
    if (child.classList.contains("mw-heading")) {
      const inner = Array.from(child.children).find((c) => /^H[2-6]$/.test(c.tagName));
      if (inner) return inner;
    }
    if (child.tagName === "SECTION") return undefined;
  }
  return undefined;
}

function sectionFor(el: Element, sectionOf: Map<Element, Section>, lead: Section): Section {
  for (let node: Element | null = el.closest("section"); node;) {
    const section = sectionOf.get(node);
    if (section) return section;
    node = node.parentElement?.closest("section") ?? null;
  }
  return lead;
}

interface Transclusion {
  name: string;
  /**
   * Targets the article's authors wrote into the template's parameters: as `[[…]]`, or as a
   * whole parameter value (`{{annotated link|Concept map}}`).
   */
  paramLinks: Set<string>;
}

/**
 * A template's output is a run of sibling elements sharing `about="#mwtN"`; only the first
 * carries `typeof="mw:Transclusion"` and `data-mw`. Maps each about ID to its template.
 */
function transclusionsOf(doc: Document): Map<string, Transclusion> {
  const found = new Map<string, Transclusion>();
  for (const el of Array.from(doc.querySelectorAll('[typeof~="mw:Transclusion"][about]'))) {
    const about = el.getAttribute("about");
    const transclusion = readDataMw(el.getAttribute("data-mw"));
    if (about && transclusion && !found.has(about)) found.set(about, transclusion);
  }
  return found;
}

interface TemplatePart {
  target?: { wt?: string; href?: string; function?: string };
  params?: Record<string, { wt?: string }>;
}
interface DataMw {
  parts?: (string | { template?: TemplatePart })[];
}

const WIKILINK = /\[\[\s*([^\]|#\n]+)/g;

function readDataMw(dataMw: string | null): Transclusion | undefined {
  if (!dataMw) return undefined;
  let data: DataMw;
  try {
    data = JSON.parse(dataMw) as DataMw;
  } catch {
    return undefined;
  }
  let name: string | undefined;
  const paramLinks = new Set<string>();
  for (const part of data.parts ?? []) {
    const template = typeof part === "object" ? part.template : undefined;
    if (!template?.target) continue;
    name ??= templateName(template.target);
    for (const param of Object.values(template.params ?? {})) {
      const wt = param.wt ?? "";
      for (const match of wt.matchAll(WIKILINK)) paramLinks.add(normalizeTitle(match[1] ?? ""));
      if (wt && !/[[\]{}<|\n]/.test(wt)) paramLinks.add(normalizeTitle(wt));
    }
  }
  return name ? { name, paramLinks } : undefined;
}

function templateName(target: NonNullable<TemplatePart["target"]>): string | undefined {
  if (target.href) {
    const title = parseHref(target.href)?.target ?? "";
    return title.slice(title.indexOf(":") + 1) || undefined;
  }
  const name = (target.function ?? target.wt ?? "").trim();
  return name ? normalizeTitle(name) : undefined;
}

/** What the walk from an element up to the body finds: the first marker and the nearest template. */
interface Context {
  marker?: LinkOrigin;
  template?: Transclusion;
}

/**
 * datamodel.md §2: the nearest marker (hatnote, navbox, infobox, reference) wins. Otherwise the
 * nearest template decides: navbox or infobox by name, `body` if the authors wrote the link into
 * its parameters (e.g. {{div col}}, {{annotated link}}), and `template` if the template adds it.
 * Contexts are cached per element, so each ancestor is inspected once per article.
 */
function createOriginFinder(transclusions: Map<string, Transclusion>, body: Element) {
  const cache = new Map<Element, Context>();

  function contextOf(el: Element | null): Context {
    if (!el || el === body) return {};
    let context = cache.get(el);
    if (context) return context;
    const about = el.getAttribute("about");
    const own = about ? transclusions.get(about) : undefined;
    const marker = originByMarkup(el);
    if (marker) {
      context = own ? { marker, template: own } : { marker };
    } else {
      // Inherit the marker from above; the nearest template is this one, or the parent's.
      // (Below a marker, the parent's template is already limited to those up to the marker.)
      const parent = contextOf(el.parentElement);
      const template = own ?? parent.template;
      context = {};
      if (parent.marker) context.marker = parent.marker;
      if (template) context.template = template;
    }
    cache.set(el, context);
    return context;
  }

  return function originOf(
    link: Element,
    target: string,
  ): { origin: LinkOrigin; template?: string } {
    const { marker, template } = contextOf(link);
    const name = template?.name;
    if (marker) return name ? { origin: marker, template: name } : { origin: marker };
    if (!template || !name) return { origin: "body" };
    if (/navbox/i.test(name)) return { origin: "navbox", template: name };
    if (/^infobox/i.test(name)) return { origin: "infobox", template: name };
    if (template.paramLinks.has(target)) return { origin: "body" };
    return { origin: "template", template: name };
  };
}

function originByMarkup(el: Element): LinkOrigin | undefined {
  const cls = el.classList;
  if (cls.length > 0) {
    for (const [origin, classes] of MARKERS) {
      if (classes.some((c) => cls.contains(c))) return origin;
    }
  }
  const type = el.getAttribute("typeof") ?? "";
  if (/\bmw:Extension\/(references|ref)\b/.test(type)) return "reference";
  return undefined;
}

function revisionOf(doc: Document): number {
  const about = doc.documentElement.getAttribute("about") ?? "";
  const match = /\/revision\/(\d+)$/.exec(about);
  return match ? Number(match[1]) : 0;
}

function plainText(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Compares dotted versions numerically: "2.10.0" > "2.8.0". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Number.isNaN(diff) ? 0 : Math.sign(diff);
  }
  return 0;
}
