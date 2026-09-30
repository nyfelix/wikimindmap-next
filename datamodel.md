# Data model

The TypeScript types that connect the layers (see `architecture.md` §3). They live in `src/core/types.ts`. This document is the contract: change it first, then the code.

```
Article + Enrichments ──Lens.build──► MapGraph ──Layout──► PositionedMap
```

## 1. Identifiers and titles

```ts
/** Wikipedia language code, e.g. "en", "de", "fr". */
type Lang = string;

/** Canonical page title: spaces (not underscores), first letter as the wiki stores it. */
type Title = string;

interface ArticleRef {
  lang: Lang;
  title: Title;
}
```

**Title rules** (`src/core/titles.ts`):
- In URLs, write `_` for spaces and percent-encode everything else (`/en/Mind_map`, `/de/Z%C3%BCrich`).
- Internally, titles use spaces and are percent-decoded.
- Parsoid link `href="./Tony_Buzan#Early_life"` becomes target `Tony Buzan` with fragment `Early life`.
- A link counts as an article link only if its namespace is 0. Namespace names come from `siteinfo` per language (`File:`, `Datei:`, `Kategorie:`…).
- The node ID of a linked article is its title **after resolving redirects**, so two links to `Mind-map` and `Mind map` become one leaf.

## 2. Article (output of the sources layer)

```ts
interface Article {
  ref: ArticleRef;
  displayTitle: string;        // may contain formatting, rendered as text
  revisionId: number;
  fetchedAt: string;           // ISO timestamp
  parserSpecVersion?: string;  // from the Parsoid Content-Type profile
  lead: Section;               // section 0: text before the first heading
  sections: Section[];         // top-level chapters in reading order
}

interface Section {
  id: number;                  // data-mw-section-id; 0 = lead
  level: number;               // 2 for "== x ==", 3 for "=== x ===", …
  title: string;               // heading text, plain
  anchor: string;              // for links to "#History"
  housekeeping: boolean;       // "See also", "References", "Weblinks"… (see §6)
  links: LinkOccurrence[];     // links directly in this section, in reading order
  children: Section[];         // subsections
}

interface LinkOccurrence {
  target: Title;               // normalized, not yet redirect-resolved
  fragment?: string;           // "#Early life" part, if any
  text: string;                // visible link text
  order: number;               // position within the whole article, 0-based
  origin: LinkOrigin;
  template?: string;           // template name if origin !== "body"
  redLink: boolean;            // target page does not exist
  redirect: boolean;           // target is a redirect page (class mw-redirect); resolve before use
}

type LinkOrigin =
  | "body"       // written in the running text
  | "hatnote"    // {{Main|…}}, {{See also|…}} at the top of a section
  | "infobox"    // inside an infobox template
  | "navbox"     // navigation box at the bottom
  | "template"   // any other template
  | "reference"; // inside a footnote
```

**Parsing rules** (`src/sources/parsoid.ts`):
- Each `<section data-mw-section-id="N">` becomes a `Section`. The first `h2`–`h6` child gives `level`, `title` and `anchor`. Nested `<section>` elements become `children`.
- Links are `a[rel="mw:WikiLink"]`. Skip links whose namespace isn't 0, and skip self-links (target = this article).
- Red links have `class="new"` and an `href` like `./Mindnode?action=edit&redlink=1`; strip the query to get the target. Links to redirect pages have `class="mw-redirect"` (spike findings: `architecture.md` §13).
- `origin` is decided by the nearest element with `typeof~="mw:Transclusion"`, starting with the link itself, and its template name, via `data-mw`:
  - navigation box: template name matches `/^Navbox|navbox/i`, or the element has class `navbox`
  - infobox: `/^Infobox/i`, or class `infobox`
  - hatnote: class `hatnote`
  - reference: inside `.mw-ref` or `.references`
  - any other enclosing template: `template`
  - no enclosing template: `body`
- A negative `data-mw-section-id` (template-generated pseudo sections) is merged into its parent.

## 3. Enrichments (optional, loaded on demand)

```ts
type DataNeed = "sections" | "summaries" | "linksBack" | "pageviews" | "kinds" | "linksHere";

interface Enrichments {
  redirects: Map<Title, Title>;             // loaded for leaf targets with redirect: true
  linksBack?: Set<Title>;                   // leaf titles that link back to the center (M3)
  summaries?: Map<Title, Summary>;          // lazily, per preview card
  pageviews?: Map<Title, number>;           // views in the last 30 days
  kinds?: Map<Title, KindInfo>;             // M5
  linksHere?: LinksHere;                    // M6
}

interface Summary {
  title: Title;
  description?: string;        // Wikidata short description
  extract: string;             // plain-text lead, 1–3 sentences
  thumbnail?: { url: string; width: number; height: number };
}

type Kind = "people" | "orgs" | "works" | "concepts" | "events" | "places";

interface KindInfo {
  qid?: string;                // "Q5"
  instanceOf: string[];        // P31 labels, e.g. ["human"]
  kind: Kind;                  // "concepts" if nothing matched
}

interface LinksHere {
  titles: Title[];             // articles linking here (namespace 0, no redirects)
  total: number;               // counted up to the cap
  capped: boolean;             // true → show "2,000+"
}
```

## 4. Lens contract

```ts
interface Lens<Options = LensOptions> {
  id: LensId;                                   // "chapters" | "kinds" | "links" | "metro"
  label: string;                                // shown in the lens switch
  needs: DataNeed[];                            // the loader fetches exactly these
  layout: LayoutId;                             // "mindmapTree" | "bipolar" | "metroLines"
  defaults: Options;
  explain: LensExplanation;                     // copy for callouts and the drawer (styleguide.md §3)
  build(article: Article, data: Enrichments, options: Options): MapGraph;
}

interface LensExplanation {
  steps: string[];                              // "How this map is built", in order
  hidden: string;                               // what is left out and why
  callouts: Partial<Record<CalloutTarget, { title: string; text: string }>>;
}
type CalloutTarget = "center" | "group" | "subgroup" | "leafDirection" | "recenter" | "line" | "station";

type LensId = "chapters" | "kinds" | "links" | "metro";
type LayoutId = "mindmapTree" | "bipolar" | "metroLines";

interface LensOptions {
  density: number;             // max leaves per group (Chapters: 2–8, default 4)
  showHousekeeping: boolean;   // include "See also" etc. (default false)
  includeOrigins: LinkOrigin[];// default ["body", "hatnote"]
  folded: string[];            // IDs of folded groups
  expanded: string[];          // IDs of groups showing all links ("+N more" clicked)
}
```

**Rules for every lens**
- `build` is pure and deterministic: the same input gives the same output, with no network or randomness.
- Every leaf gets a `direction`. Lenses that show links from the article use `out`, or `both` when the title is in `linksBack`, or `pending` while `linksBack` hasn't loaded. Incoming-only links (`in`) come from `linksHere`.
- Every node that has children can fold (`folded` is defined, `false` when open).
- Leaves are deduplicated **within a group** (a link used twice in one chapter shows once). Across groups a leaf may repeat, and its node `id` includes the group so IDs stay unique.
- When a group has more leaves than `density`, keep the first `density` by rank and add one `more` node with the count. Groups listed in `expanded` show all their leaves.
- **Rank within a group:** Chapters ranks by reading order, then by occurrence count. Lenses with page views rank by views. Ties are broken by reading order.

## 5. MapGraph (lens output, layout input)

```ts
interface MapGraph {
  lens: LensId;
  center: MapNode;             // kind "center"
  nodes: MapNode[];            // everything except the center
  edges: MapEdge[];
  groups: GroupInfo[];         // legend: one entry per first-level branch
  notes?: string[];            // e.g. "Places: none linked"
}

interface MapNode {
  id: string;                  // stable across re-renders: e.g. "g2/Tony Buzan"
  kind: "center" | "group" | "subgroup" | "leaf" | "more";
  label: string;
  target?: Title;              // leaves (and center): the article it stands for
  parent?: string;             // node id; undefined only for center
  colorSlot?: number;          // 1–6 → --b1…--b6; undefined → muted
  weight?: number;             // 0–1 relative page views; drives the bar behind the label (Kinds, Links). Symbol size stays fixed.
  count?: number;              // "more" nodes and folded groups: hidden items
  folded?: boolean;            // set on every node that has children; true = folded
  direction?: LinkDirection;   // leaves: shown as a symbol (styleguide.md §5)
  side?: "left" | "right" | "top";   // layout hint (bipolar, fixed kinds slots)
  meta?: Record<string, string | number>;  // shown in the preview card
}

type LinkDirection = "out" | "both" | "in" | "pending";

interface MapEdge {
  from: string;
  to: string;
  style: "trunk" | "branch" | "twig" | "in" | "out" | "both" | "line";
}

interface GroupInfo {
  id: string;
  label: string;
  colorSlot?: number;
  count: number;
}
```

## 6. Layout output (renderer input)

```ts
interface PositionedMap {
  viewBox: { x: number; y: number; width: number; height: number };
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

interface PositionedNode {
  node: MapNode;
  x: number;
  y: number;
  labelSide: "left" | "right" | "above" | "center";
}

interface PositionedEdge {
  edge: MapEdge;
  path: string;                // SVG path data, e.g. "M0 0 C…"
  width: number;               // stroke width
}

type Layout = (graph: MapGraph, viewport: { width: number; height: number }) => PositionedMap;
```

## 7. Housekeeping sections

`src/core/housekeeping.ts` holds, per language, the headings hidden by default. The list is matched case-insensitively against the full heading.

| Lang | Headings |
|---|---|
| en | See also, References, Notes, Footnotes, Citations, Sources, Bibliography, Further reading, External links |
| de | Siehe auch, Einzelnachweise, Anmerkungen, Literatur, Weblinks, Quellen |
| fr | Voir aussi, Notes et références, Références, Bibliographie, Liens externes |

Unknown languages fall back to the `en` list. More languages are added as needed.

## 8. URL and app state

The URL is the source of truth for anything shareable.

```
/{lang}/{Title}?lens=chapters&density=4&hk=0&fold=2,5.1&more=3
```

| Param | Meaning | Default |
|---|---|---|
| path `lang` | Wikipedia language | browser language if a wiki exists for it, else `en` |
| path `Title` | center article | missing → start page: the map of "Mind map" in the current language (en *Mind map*, de *Mindmap*, fr *Carte heuristique*, others via `langlinks`); the URL stays `/` |
| `lens` | active lens | `chapters` |
| `density` | leaves per group | lens default |
| `hk` | show housekeeping sections (`1`/`0`) | `0` |
| `fold` | folded group IDs, comma-separated | none |
| `more` | group IDs showing all links, comma-separated | none |

State that isn't in the URL:

```ts
interface Trail {
  steps: TrailStep[];          // in visit order
  current: number;             // index into steps
}
interface TrailStep {
  ref: ArticleRef;
  via?: string;                // group label the reader came through, e.g. "History"
  lens: LensId;
}
```

The trail lives in `history.state` (so browser back and forward work) and is mirrored to `sessionStorage`. Going back along the trail uses browser history. Recentering from the middle of the trail cuts off the steps after it, like a browser does.

## 9. Test fixtures

```
tests/fixtures/{lang}/{Title}/
  page.html          Parsoid HTML as returned by rest.php
  headers.json       response headers (Content-Type profile, revision)
  summary.json
  redirects.json     action=query&redirects for the article's link targets
  linksback.json     links back to the center (M3)
  pageviews.json     (M5)  wikidata.json (M5)  linkshere.json (M6)
tests/fixtures/{lang}/siteinfo.json
```

Starter set, recorded in M0:
- **en:** Mind map, Tony Buzan, Concept map, Zürich, Albert Einstein, Photosynthesis, World War II, Python (programming language), Chess, Mount Everest
- **de:** Mindmap, Zürich, Albert Einstein, Photosynthese
- **fr:** Carte heuristique

This set covers short and long articles, heavy use of infoboxes and navigation boxes, and three languages.
