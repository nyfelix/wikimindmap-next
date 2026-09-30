# Architecture

WikiMindMap 2027 is a **static single-page app**. The browser talks directly to the public Wikimedia APIs, and there is no server of our own in the MVP. Everything that decides *what* a map shows is plain TypeScript, separate from how it is drawn. That lets lenses be added one at a time.

## 1. Goals and constraints

| Goal | Consequence |
|---|---|
| Nothing to maintain (this is what ended the 2007 version) | Static hosting on GitHub Pages, no backend in the MVP |
| Fast: a map within ~1 s from cache, ~2.5 s cold | One request for the article structure, batched follow-ups, local cache |
| Lenses can be added one by one | Lens = pure function with a declared data need; shared layouts and renderer |
| Works on phones, with keyboard and screen readers | SVG map plus an outline view generated from the same graph |
| Well-behaved Wikimedia client | Identifying header, batching, concurrency limit, caching |
| Vibe-coding friendly | Mainstream stack (React, TypeScript), strict boundaries, tests on real fixtures |

## 2. System context

```mermaid
flowchart LR
  U[Reader's browser<br/>WikiMindMap SPA] -->|static files| GH[GitHub Pages]
  U -->|REST: page HTML, summary, search| WP[xx.wikipedia.org]
  U -->|Action API: pageviews, linkshere, pageprops, redirects, siteinfo| WP
  U -.->|M5: entity types| WD[wikidata.org]
  U -.->|later| CF[Cloudflare Worker<br/>Clickstream, path finder, AI]
```

All Wikimedia endpoints allow anonymous cross-site reads:
- **Action API** (`/w/api.php`): add `origin=*` to every request.
- **REST API** (`/w/rest.php/v1/…`): sends CORS headers for any site.

Requests are read-only and carry no cookies.

## 3. The pipeline

```
sources ──► Article ──► Lens.build() ──► MapGraph ──► Layout ──► PositionedMap ──► Renderer (SVG / outline)
(network)    (core)      (lenses/)        (core)       (layouts/)    (core)             (ui/map/)
                ▲
          Enrichments (pageviews, kinds, linksHere…) loaded on demand, based on lens.needs
```

1. **Sources** fetch and normalize raw API data. Only this layer knows URLs and response formats.
2. **Article** is the normalized model: the section tree, the link occurrences per section, and the lead text (see `datamodel.md`).
3. **Enrichments** are optional data sets keyed by title. They are loaded only when the active lens declares a need for them.
4. **Lens** is `build(article, enrichments, options) → MapGraph`. It is pure and deterministic, so it can be tested with fixtures.
5. **Layout** is `layout(graph, viewport) → PositionedMap`, with x/y for every node and a path for every edge. Several lenses share one layout.
6. **Renderer** is React components that draw a `PositionedMap` as SVG, plus `OutlineView`, which draws the same `MapGraph` as nested lists.

### Lens and layout matrix

| Lens | Milestone | Data needs | Layout |
|---|---|---|---|
| Chapters | M2–M4 (MVP) | `sections` | `mindmapTree` (two-sided tidy tree) |
| Kinds | M5 | `sections`, `pageviews`, `kinds` | `mindmapTree` |
| Links in / out | M6 | `sections`, `pageviews`, `linksHere` | `bipolar` |
| Metro | M7 | `sections` | `metroLines` |

## 4. Data sources

Every URL below is built in `src/sources/`. The `{lang}` is the Wikipedia language code (`en`, `de`, …).

| Need | Endpoint | Notes |
|---|---|---|
| Article structure and links | `GET https://{lang}.wikipedia.org/w/rest.php/v1/page/{title}/html` | Parsoid HTML, one request. `<section data-mw-section-id>` gives the chapter tree; `a[rel="mw:WikiLink"]` gives the links; `typeof="mw:Transclusion"` marks content from templates. |
| Search suggestions | `GET /w/rest.php/v1/search/title?q={q}&limit=8` | Title, short description, thumbnail |
| Preview card | `GET /api/rest_v1/page/summary/{title}` | Lead extract and thumbnail. Check in M0 whether a core-REST equivalent exists; if so, use it. |
| Redirects and normalization | `action=query&redirects=1&titles=A|B|…` | 50 titles per request. Used to deduplicate leaves and to recenter on the real article. |
| Namespaces | `action=query&meta=siteinfo&siprop=namespaces|namespacealiases` | Once per language, cached 7 days. Filters out `File:`, `Kategorie:` and so on. |
| Page views (M5) | `action=query&prop=pageviews&titles=…&pvipdays=30` | 50 titles per request; sum the daily values |
| Wikidata IDs (M5) | `action=query&prop=pageprops&ppprop=wikibase_item&titles=…` | 50 per request |
| Entity types (M5) | `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=…&props=claims` | Read P31 (instance of). Map it to a kind with `kindMap.json`. |
| Incoming links (M6) | `action=query&list=backlinks&blnamespace=0&blfilterredir=nonredirects&bltitle=…&bllimit=500` | Page through the results up to a cap of 2,000 and show "2,000+" beyond that |

### Why Parsoid HTML, not wikitext or the rendered page

- **Wikitext** doesn't contain the links that templates produce (`{{Main|…}}`, infoboxes, navigation boxes). Parsing it correctly means reimplementing MediaWiki's parser.
- **The rendered page HTML** (what readers see) changes with the skin. Scraping it is what made the 2007 version fragile.
- **Parsoid HTML** follows a documented, versioned specification (the *MediaWiki DOM Spec*) and marks sections, links and templates explicitly. It's what Wikipedia's visual editor and mobile apps are built on.

To keep the risk contained:
- Only `src/sources/parsoid.ts` reads the HTML.
- The spec version is read from the `Content-Type` profile, and a warning is logged if it's newer than the version we tested.
- Tests run on about 20 recorded articles in `en` and `de`.
- **Fallback:** if parsing fails, fetch `action=parse&prop=sections` and then `action=parse&section=N&prop=links` for each section. This is slower but gives the same `Article`.

### API etiquette

- Header on every request: `Api-User-Agent: WikiMindMap/2027 (https://github.com/nyfelix/wikimindmap-next)`.
- At most 4 concurrent requests. Title lookups are batched 50 per request.
- Cache first (see §6). There's no automatic polling or prefetching beyond the visible map.
- On HTTP 429 or 503: back off exponentially (1 s, 2 s, 4 s), then show an error with a retry button.

## 5. Stack

| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript (strict) | Clear contracts between layers; fewer AI coding mistakes |
| Build | Vite | Fast, simple static output |
| UI | React 19 | Best supported by AI coding tools, large ecosystem |
| Routing | React Router (library mode) | Well known; path-based URLs |
| Server state | TanStack Query | Caching, retries, request deduplication |
| Persistent cache | TanStack Query persister on IndexedDB (`idb-keyval`) | Instant back navigation and repeat visits |
| Tree layout | `d3-hierarchy` (this module only) | Proven tidy-tree algorithm |
| Animation | CSS transitions; Motion (`motion`) for the recenter move if CSS isn't enough | Recentering is the signature moment |
| Styling | Plain CSS with custom properties (`tokens.css`), CSS Modules per component | Custom design; fonts must stay swappable |
| Unit tests | Vitest + happy-dom (for `DOMParser`) | Fast, Vite-native |
| End-to-end | Playwright, with the network mocked from fixtures | Real browser, no live API |
| Lint/format | ESLint (typescript-eslint, react-hooks) + Prettier | Standard |
| CI/CD | GitHub Actions → GitHub Pages (`actions/deploy-pages`) | Free, same place as the code |

Not used, on purpose: no state library (URL + React state + Query are enough), no UI kit (the design is custom), no Tailwind (tokens come from the concept), no D3 beyond `d3-hierarchy` until the network lens needs `d3-force`.

## 6. Caching

| Data | Key | Lifetime |
|---|---|---|
| Article (parsed) | `article:{lang}:{title}:{revision}` | 24 h |
| Summary | `summary:{lang}:{title}` | 24 h |
| Siteinfo namespaces | `siteinfo:{lang}` | 7 days |
| Pageviews | `pageviews:{lang}:{title}` | 24 h |
| Kinds (Wikidata) | `kind:{qid}` | 7 days |
| linksHere | `linksHere:{lang}:{title}` | 24 h |

The cache is stored in IndexedDB and cleared when the cache schema version changes. If storage is unavailable (private mode), the app keeps working with an in-memory cache.

## 7. Routing and hosting on GitHub Pages

- **URLs:** `/{lang}/{Title}` with an optional query string, for example `/en/Mind_map?lens=chapters&density=4`.
- **Deep links:** GitHub Pages has no rewrites. The build therefore copies `index.html` to `404.html`, so deep links load the app, which reads the path.
  - *Trade-off:* the first response for a deep link has HTTP status 404. Browsers don't care, but link-preview bots may. Accepted for the MVP. A custom domain on Cloudflare fixes it later.
- **Base path:** `vite.config.ts` reads `BASE_PATH`. It is `/wikimindmap-next/` on `github.io`, and `/` once a custom domain is set.
- **Deploy:** push to `main`, then the GitHub Action runs `check`, `build` and deploys to Pages.

## 8. Module layout

```
.devcontainer/          dev container for VS Code (see §14)
src/
  core/                 pure types and helpers (no DOM, no fetch)
    types.ts            Article, MapGraph, PositionedMap… (see datamodel.md)
    titles.ts           title normalization, url ↔ title
    housekeeping.ts     "See also", "References"… per language
  sources/              the only code that talks to the network
    http.ts             fetch wrapper: header, origin=*, concurrency, retries
    parsoid.ts          Parsoid HTML → Article (DOMParser passed in)
    parseFallback.ts    action=parse fallback → Article
    search.ts, summary.ts, siteinfo.ts, redirects.ts
    pageviews.ts, wikidata.ts, linksHere.ts     (M5, M6)
  lenses/
    index.ts            registry: id → Lens
    chapters.ts         M2
    kinds.ts, kindMap.json                      (M5)
    links.ts                                    (M6)
    metro.ts                                    (M7)
  layouts/
    mindmapTree.ts      M2
    bipolar.ts          M6
    metroLines.ts       M7
  ui/
    App.tsx, routes.tsx
    search/             SearchBox, suggestions
    map/                MapView, SvgMap, nodes, RecenterButton, OutlineView
    panels/             PreviewCard, Trail, LensSwitch, Settings
    hooks/              useArticle, useEnrichments, useMapState
    styles/tokens.css   from concepts/assets/lens.css
  main.tsx
scripts/
  record-fixture.ts     npm run fixtures -- en "Mind map"
  build-kind-map.ts     M5: builds lenses/kindMap.json from Wikidata SPARQL
tests/
  fixtures/{lang}/{Title}/   html.html, summary.json, siteinfo.json…
  unit/                 parsoid, lenses, layouts
  e2e/                  Playwright specs
concepts/               lens previews (reference only)
```

Dependency direction (enforced by ESLint `no-restricted-imports`):

```
ui ──► lenses, layouts, sources, core
sources ──► core
lenses ──► core
layouts ──► core
core ──► (nothing)
```

## 9. Rendering

- **SVG**, one `<svg>` with a `viewBox` taken from the layout. Up to ~200 nodes is comfortably fast, so no Canvas is needed.
- **Nodes** are real focusable elements (`role="button"`) with labels. The ⊕ recenter control is a separate button.
- **Recenter animation:** nodes keep stable IDs (the target title). When the new map shares nodes with the old one, they move to their new place. Old nodes fade out and new ones fade in. Duration 450 ms, and none with `prefers-reduced-motion`.
- **Outline view:** the same `MapGraph` rendered as nested `<ul>`. It's the default for screen readers, and a toggle for everyone else.
- **Mobile (< 768 px):** the tree shows only its first level at first. Tapping a branch expands it, and the preview card becomes a bottom sheet.

## 10. Quality

| Area | Target |
|---|---|
| Performance | Map visible in < 1 s from cache and < 2.5 s cold on 4G, for a 10,000-word article |
| Bundle | < 200 kB gzipped initial JS |
| Accessibility | WCAG 2.2 AA: keyboard path through search → map → preview → recenter; visible focus |
| Browsers | Last 2 versions of Chrome, Safari, Firefox and Edge; iOS Safari 17+ |
| Tests | Every lens and layout has fixture-based unit tests; one e2e test per user-visible flow |
| Errors | Every failed request shows a message with a retry, never a blank map |

## 11. Security and privacy

- No accounts, no cookies, no analytics in the MVP. Nothing leaves the browser except Wikimedia API requests.
- No secrets in the frontend, ever. AI features (later) go through a Worker that holds the key.
- Article HTML is parsed with `DOMParser` into an inert document and never inserted into the page. Only extracted strings are rendered, as text.

## 12. Later (not in the MVP)

| Feature | Needs |
|---|---|
| Reader clicks lens (Clickstream) | A Cloudflare Worker plus storage with monthly preprocessed Clickstream data |
| Path finder, "why is this linked?" | A Worker (link graph search), optionally the Claude API for explanations |
| Custom domain (wikimindmap.org) | DNS, then move hosting to Cloudflare Pages to get proper deep-link status codes |
| Export (PNG, SVG, OPML, Markdown) | Frontend only, from `PositionedMap` and `MapGraph` |

## 13. Open points to verify in M0 (spike)

1. `rest.php/v1/page/{title}/html` returns Parsoid HTML with `<section>` wrappers and CORS headers for `en` and `de`.
2. `Api-User-Agent` is accepted in CORS preflight on both `rest.php` and `api.php`.
3. Which summary endpoint to use long-term (`/api/rest_v1/page/summary` vs. a core-REST equivalent).
4. How Parsoid marks red links (links to missing pages) and redirects, and whether we need the `redirects` lookup for every leaf or only on recenter.
5. `prop=pageviews` is available on all target language wikis.

Record the findings in this section and adjust the plan if needed.

## 14. Development environment

All development happens in a **VS Code dev container**, so the host only needs Docker (Docker Desktop or OrbStack) and VS Code. Node, npm, Playwright's browsers and Claude Code all live in the container, and everyone gets the same versions.

```
.devcontainer/
  devcontainer.json
  post-create.sh      # chown volumes; npm ci + Playwright browsers once package.json exists
```

| Setting | Value | Why |
|---|---|---|
| Base image | `mcr.microsoft.com/devcontainers/typescript-node:22` | Node 22 LTS + npm + git, maintained by Microsoft |
| Features | GitHub CLI; Claude Code (Anthropic's dev container feature) | `gh` for PRs and Pages settings; Claude runs in the same environment as the code |
| Extensions | Claude Code, ESLint, Prettier, Vitest, Playwright, EditorConfig | Installed automatically in the container |
| Volumes | `node_modules` → named volume; `/home/node/.claude` → named volume | Fast installs on macOS (no bind-mount slowdown); the Claude login survives rebuilds |
| `postCreateCommand` | `npm ci` (if `package.json` exists) and `npx playwright install --with-deps chromium` | Ready to run `npm run check` and `npm run e2e` right after the build |
| Ports | 5173 (Vite dev), 4173 (Vite preview), 9323 (Playwright report) | Forwarded to the host browser |
| Editor settings | Format on save (Prettier), ESLint fix on save | Consistent code, whoever or whatever writes it |

**Rules**
- A missing tool goes into `devcontainer.json` (a feature or `postCreateCommand`), never installed by hand inside a running container. Otherwise the next rebuild loses it.
- CI uses the same Node major version (22) as the container, via `.nvmrc`.
- Network access from the container is unrestricted. The fixture recorder and the dev server need Wikipedia.
- *Optional, later:* Anthropic's reference dev container adds an outbound firewall, for running Claude Code with fewer permission prompts. If adopted, allow `*.wikipedia.org`, `*.wikimedia.org`, `www.wikidata.org`, `registry.npmjs.org` and `github.com`.

