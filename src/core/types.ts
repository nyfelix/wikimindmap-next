/**
 * The types that connect the layers. datamodel.md is the contract: change it first, then this file.
 *
 *   Article + Enrichments ──Lens.build──► MapGraph ──Layout──► PositionedMap
 */

// ── §1 Identifiers and titles ───────────────────────────────────────────────

/** Wikipedia language code, e.g. "en", "de", "fr". */
export type Lang = string;

/** Canonical page title: spaces (not underscores), first letter as the wiki stores it. */
export type Title = string;

export interface ArticleRef {
  lang: Lang;
  title: Title;
}

/** What the core needs from `meta=siteinfo` (normalized in `sources/siteinfo.ts`). */
export interface Siteinfo {
  lang: Lang;
  /** Every namespace name, canonical name and alias, lower-case with spaces → namespace ID. */
  namespaces: Record<string, number>;
}

// ── §2 Article ──────────────────────────────────────────────────────────────

export interface Article {
  ref: ArticleRef;
  /** May contain formatting, rendered as text. */
  displayTitle: string;
  revisionId: number;
  /** ISO timestamp. */
  fetchedAt: string;
  /** From the Parsoid Content-Type profile. */
  parserSpecVersion?: string;
  /** Which parser built this article (TS-07). */
  source: ArticleSource;
  /** Section 0: text before the first heading. */
  lead: Section;
  /** Top-level chapters in reading order. */
  sections: Section[];
}

export type ArticleSource = "parsoid" | "fallback";

export interface Section {
  /** `data-mw-section-id`; 0 = lead. */
  id: number;
  /** 2 for "== x ==", 3 for "=== x ===", …; 1 for the lead. */
  level: number;
  /** Heading text, plain. */
  title: string;
  /** For links to "#History". */
  anchor: string;
  /** "See also", "References", "Weblinks"… (datamodel.md §7). */
  housekeeping: boolean;
  /** Links directly in this section, in reading order. */
  links: LinkOccurrence[];
  /** Subsections. */
  children: Section[];
}

export interface LinkOccurrence {
  /** Normalized, not yet redirect-resolved. */
  target: Title;
  /** "#Early life" part, if any (without "#"). */
  fragment?: string;
  /** Visible link text. */
  text: string;
  /** Position within the whole article, 0-based. */
  order: number;
  origin: LinkOrigin;
  /** Template name if origin !== "body". */
  template?: string;
  /** Target page does not exist. */
  redLink: boolean;
  /** Target is a redirect page (class mw-redirect); resolve before use. */
  redirect: boolean;
}

export type LinkOrigin =
  | "body" // written in the running text
  | "hatnote" // {{Main|…}}, {{See also|…}} at the top of a section
  | "infobox" // inside an infobox template
  | "navbox" // navigation box at the bottom
  | "template" // any other template
  | "reference"; // inside a footnote

// ── §3 Enrichments ──────────────────────────────────────────────────────────

export type DataNeed = "sections" | "summaries" | "linksBack" | "pageviews" | "kinds" | "linksHere";

export interface Enrichments {
  /** Loaded for leaf targets with `redirect: true`. */
  redirects: Map<Title, Title>;
  /** Leaf titles that link back to the center (M3). */
  linksBack?: Set<Title>;
  /** Titles the links-back check has covered; leaves outside it stay "pending". */
  linksChecked?: Set<Title>;
  /** Lazily, per preview card. */
  summaries?: Map<Title, Summary>;
  /** Views in the last 30 days. */
  pageviews?: Map<Title, number>;
  /** M5. */
  kinds?: Map<Title, KindInfo>;
  /** M6. */
  linksHere?: LinksHere;
}

export interface Summary {
  title: Title;
  /** Wikidata short description. */
  description?: string;
  /** Plain-text lead, 1–3 sentences. */
  extract: string;
  thumbnail?: { url: string; width: number; height: number };
}

export type Kind = "people" | "orgs" | "works" | "concepts" | "events" | "places";

export interface KindInfo {
  /** "Q5". */
  qid?: string;
  /** P31 labels, e.g. ["human"]. */
  instanceOf: string[];
  /** "concepts" if nothing matched. */
  kind: Kind;
}

export interface LinksHere {
  /** Articles linking here (namespace 0, no redirects). */
  titles: Title[];
  /** Counted up to the cap. */
  total: number;
  /** true → show "2,000+". */
  capped: boolean;
}

// ── §4 Lens contract ────────────────────────────────────────────────────────

export type LensId = "chapters" | "kinds" | "links" | "metro";
export type LayoutId = "mindmapTree" | "bipolar" | "metroLines";

export interface Lens<Options = LensOptions> {
  id: LensId;
  /** Shown in the lens switch. */
  label: string;
  /** The loader fetches exactly these. */
  needs: DataNeed[];
  layout: LayoutId;
  defaults: Options;
  /** Copy for callouts and the drawer (styleguide.md §3). */
  explain: LensExplanation;
  build(article: Article, data: Enrichments, options: Options): MapGraph;
}

export interface LensExplanation {
  /** "How this map is built", in order. */
  steps: string[];
  /** What is left out and why. */
  hidden: string;
  callouts: Partial<Record<CalloutTarget, { title: string; text: string }>>;
}

export type CalloutTarget =
  "center" | "group" | "subgroup" | "leafDirection" | "recenter" | "line" | "station";

export interface LensOptions {
  /** Max leaves per group (Chapters: 2–8, default 4). */
  density: number;
  /** Include "See also" etc. (default false). */
  showHousekeeping: boolean;
  /** Default ["body", "hatnote"]. */
  includeOrigins: LinkOrigin[];
  /** IDs of folded groups. */
  folded: string[];
  /** IDs of groups showing all links ("+N more" clicked). */
  expanded: string[];
}

// ── §5 MapGraph ─────────────────────────────────────────────────────────────

export interface MapGraph {
  lens: LensId;
  /** Kind "center". */
  center: MapNode;
  /** Everything except the center. */
  nodes: MapNode[];
  edges: MapEdge[];
  /** Legend: one entry per first-level branch. */
  groups: GroupInfo[];
  /** E.g. "Places: none linked". */
  notes?: string[];
}

export interface MapNode {
  /** Stable across re-renders: e.g. "g2/Tony Buzan". */
  id: string;
  kind: "center" | "group" | "subgroup" | "leaf" | "more";
  label: string;
  /** Leaves (and center): the article it stands for. */
  target?: Title;
  /** Node id; undefined only for center. */
  parent?: string;
  /** 1–6 → --b1…--b6; undefined → muted. */
  colorSlot?: number;
  /** 0–1 relative page views; drives the bar behind the label (Kinds, Links). */
  weight?: number;
  /** "more" nodes and folded groups: hidden items. */
  count?: number;
  /** Set on every node that has children; true = folded. */
  folded?: boolean;
  /** Leaves: the article doesn't exist (muted, no ⊕). */
  redLink?: boolean;
  /** Leaves: shown as a symbol (styleguide.md §5). */
  direction?: LinkDirection;
  /** Layout hint (bipolar, fixed kinds slots). */
  side?: "left" | "right" | "top";
  /** Shown in the preview card. */
  meta?: Record<string, string | number>;
}

export type LinkDirection = "out" | "both" | "in" | "pending";

export interface MapEdge {
  from: string;
  to: string;
  style: "trunk" | "branch" | "twig" | "in" | "out" | "both" | "line";
}

export interface GroupInfo {
  id: string;
  label: string;
  colorSlot?: number;
  count: number;
}

// ── §8 State that isn't in the URL ─────────────────────────────────────────

export interface Trail {
  /** In visit order. */
  steps: TrailStep[];
  /** Index into steps. */
  current: number;
}

export interface TrailStep {
  ref: ArticleRef;
  /** Group label the reader came through, e.g. "History". */
  via?: string;
  lens: LensId;
}

// ── §6 Layout output ────────────────────────────────────────────────────────

export interface PositionedMap {
  viewBox: { x: number; y: number; width: number; height: number };
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

export interface PositionedNode {
  node: MapNode;
  x: number;
  y: number;
  /** The direction the label runs from the node point. */
  labelSide: "left" | "right" | "above" | "center";
  /** 1 on the right half of the map, -1 on the left (arrows are mirrored). */
  side: 1 | -1;
  /** 0 for the center, 1 for first-level groups, … */
  depth: number;
  /** The label as drawn: long labels are shortened with "…". */
  text: string;
  /** Measured width of `text`. */
  textWidth: number;
}

export interface PositionedEdge {
  edge: MapEdge;
  /** SVG path data, e.g. "M0 0 C…". */
  path: string;
  /** Stroke width. */
  width: number;
}

/** The text styles on the map; fonts per style come from the CSS tokens. */
export type TextStyle = "center" | "group" | "subgroup" | "leaf" | "leafBold" | "count";

/** Measures the rendered width of a text in a style. */
export type MeasureText = (text: string, style: TextStyle) => number;

export interface LayoutOptions {
  /** Measures text in the real fonts; layouts fall back to an estimate. */
  measure?: MeasureText;
  /** Leaves drawn bold (a map for them is cached). */
  bold?: (node: MapNode) => boolean;
  /** Distance between leaf rows; larger on touch screens, for 44 px tap targets. */
  row?: number;
}

export type Layout = (
  graph: MapGraph,
  viewport: { width: number; height: number },
  options?: LayoutOptions,
) => PositionedMap;
