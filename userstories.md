# User stories and implementation plan

Work through the milestones in order. A milestone is done when every story in it is ticked and its **Done when** line holds. The MVP ("Relaunch") is M0–M4. The other lenses follow in M5–M7.

**Conventions**
- `US-xx` is a user story (visible to readers). `TS-xx` is a technical story (needed, not visible). `DS-xx` is a design decision made with the owner.
- Tick `[x]` when an acceptance criterion is met and tested. If something ended up different from the plan, add a line `> Note: …` under the story.
- When every criterion of a story is ticked, move the story to **Implemented** at the end of this file.
- Size: **S** takes a few hours, **M** about a day, **L** several days (of AI-assisted work).

**Personas**
- **Curious reader:** wanders from topic to topic for fun.
- **Student:** wants a quick overview of one article before reading it.
- **Teacher:** shares a map as a starting point for a class.

---

## M0 – Setup and spike

Goal: a reproducible dev environment, a deployable empty app, and certainty that the Wikipedia APIs behave as `architecture.md` assumes.

**Done when:** the repo opens in the dev container with everything working, the empty app deploys from `main`, and the spike findings are recorded.

---

## M1 – Article model

Goal: any Wikipedia article can be turned into a reliable `Article`.

**Done when:** `loadArticle` returns a correct `Article` for all fixtures, and tests cover both parsers.

---

## M2 – Chapters lens on a static map

Goal: the 2007 map, drawn from a fixture, with no search yet. This is the core of the product.

**Done when:** the typography and logo are decided, and every starter fixture renders as a readable, full-window Chapters map in `/dev/fixture/…`, in light and dark, with folding, pan and zoom.

---

## M3 – Live search, recenter and trail

Goal: the full 2007 loop with live data.

**Done when:** a reader can search, open a map, preview, recenter three times and go back, all with live data on the deployed site.

---

## M4 – MVP polish and relaunch

Goal: good enough to announce.

### TS-11 Performance and error budget · S
- [ ] The Lighthouse performance score is ≥ 90 on the start page and on `/en/Mind_map`
- [x] Initial JS is < 200 kB gzipped
- [x] Errors are caught by an error boundary with a friendly message; no blank screens
> Note: Initial JS is 123 kB gzipped; editorial pages and their fonts are separate chunks. Lighthouse can't run in the dev container (both Chromium builds lose the connection to it), so the score is still open: it will be measured with PageSpeed Insights on the deployed site. Measured with Playwright under Lighthouse's mobile conditions (4× CPU, slow 4G): FCP 1.1 s, LCP 2.8 s, TBT ≤ 57 ms, CLS 0.02 on `/` and `/en/Mind_map`; LCP waits for Wikipedia's article over the throttled network.

### TS-12 Release · S
- [ ] Version `1.0.0` is tagged, with a changelog in `README.md`
- [ ] If a custom domain is chosen, DNS is set up and `BASE_PATH` switched to `/`

**Done when:** the MVP is live and announced. 🎉

---

## M5 – Kinds lens

Preview: `concepts/lens-kinds.html`

### TS-14 Page views and Wikidata sources · M
- [ ] `sources/pageviews.ts` (batches of 50, 30-day sum, follows `pvipcontinue`) and `sources/wikidata.ts` (pageprops → `wbgetentities` P31 → `kindMap`)
- [ ] The loader fetches them only when the active lens declares `pageviews` or `kinds` in `needs`
- [ ] Fixtures are recorded for the starter set

### US-13 See links grouped by kind · M
*As a curious reader, I want to see people, places, works and so on as fixed branches, so every map reads the same way.*
- [ ] Six fixed branches in fixed positions, the same as the preview. Empty branches are shown as dotted lines with "none linked".
- [ ] Branches fold like in Chapters; leaves show direction symbols
- [ ] Explanation copy (callouts and drawer) for this lens, following `styleguide.md` §3
- [ ] Leaves are ranked by page views. Direction symbols keep their fixed size; page views show as a thin bar behind the label (`styleguide.md` §5) and as a number in the preview card.
- [ ] The preview card shows kind, "instance of" and views per month

### US-14 Switch lenses · S
*As a reader, I want to switch between Chapters and Kinds on the same article.*
- [ ] Kinds changes from "soon" to selectable in the lens switch (see US-20). Switching keeps the center and the trail.
- [ ] `lens=` is in the URL, and the trail records the lens used for each step

---

## M6 – Links in / out lens

Preview: `concepts/lens-links.html`

### TS-15 Incoming links source · S
- [ ] `sources/linksHere.ts` uses `list=backlinks` in namespace 0 without redirects, pages up to a cap of 2,000, and reports `total` and `capped`
- [ ] Links coming only from navigation boxes are excluded where they can be detected (optional, noted if not feasible)

### US-15 See where a topic comes from and leads to · M
*As a student, I want to see which articles point to this one and which it points to, so I understand its context.*
- [ ] `layouts/bipolar.ts`: incoming links on the left, outgoing on the right, both-way links as pills in a band on top, with arrows showing direction
- [ ] Each side is ranked by page views and has its own density
- [ ] Totals are shown per side ("Links here · 2,000+")
- [ ] Leaves show direction symbols, including *in* (`styleguide.md` §5). Each side folds.
- [ ] Explanation copy (callouts and drawer) for this lens

---

## M7 – Metro lens

Preview: `concepts/lens-metro.html`

### US-16 See the threads through an article · M
*As a student, I want to see which ideas run through a long article, so I know what holds it together.*
- [ ] `lenses/metro.ts`: a line is a linked article that occurs in ≥ 2 top-level chapters (body and hatnote links only). Rank by chapter count, then page views.
- [ ] `layouts/metroLines.ts`: the article line on top, one station per chapter, and colored lines with stops on their own lanes, as in the preview
- [ ] Clicking a station shows the chapter's links. Clicking a line gives the preview and recenter.
- [ ] Articles without recurring links show "No link appears in more than one chapter"
- [ ] Line badges show direction symbols. Lines can be folded (hide their stations).
- [ ] Explanation copy (callouts and drawer) for this lens

---

## Later (not planned in detail)

- Phone layout (< 768 px): map, search and trail only; the preview card as a bottom sheet
- Export the map as PNG, SVG, OPML and Markdown
- Share a journey (the whole trail as a link)
- Reader clicks lens (Wikipedia Clickstream; needs a Worker)
- Path finder between two articles; "Why is this linked?" with the quoted sentence and optional AI explanation
- Compare two maps
- Classroom mode
- Other wikis (Wiktionary, Wikivoyage)

---

## Implemented

Finished stories, in the order they were done. Each keeps its milestone in the heading.

### TS-00 Dev container · S · M0
Set up the development environment as described in `architecture.md` §14. All later stories are done inside it.
- [x] `.devcontainer/devcontainer.json` based on `mcr.microsoft.com/devcontainers/typescript-node:22` (Node 22 LTS, npm, git)
- [x] Features: GitHub CLI and Claude Code (`ghcr.io/anthropics/devcontainer-features/claude-code`; check the current name and version before use)
- [x] VS Code extensions installed automatically: Claude Code, ESLint, Prettier, Vitest, Playwright, EditorConfig
- [x] `node_modules` lives in a named volume (fast on macOS). `~/.claude` lives in a named volume, so the Claude login and settings survive rebuilds.
- [x] `postCreateCommand` runs `npm ci` (once `package.json` exists) and `npx playwright install --with-deps chromium`
- [x] Ports forwarded: 5173 (dev server), 4173 (preview build), 9323 (Playwright report)
- [x] Format on save with Prettier, and ESLint fixes on save, in `.devcontainer` settings
- [x] Opening the repo in VS Code offers "Reopen in Container". After the build, `node -v` shows v22 and `claude --version` works in the container terminal.
- [x] The README says how to start (Docker Desktop or OrbStack on the host, then "Reopen in Container") and that nothing else needs installing on the host

> Note: Feature pinned as `ghcr.io/anthropics/devcontainer-features/claude-code:1.0` (1.0.5 on 2026-09-30). The Playwright install is guarded together with `npm ci` (in `.devcontainer/post-create.sh`), so it uses the project's pinned Playwright version once TS-02 adds it. `CLAUDE_CONFIG_DIR` points into the `~/.claude` volume so `.claude.json` persists too. Build verified with the Dev Containers CLI; the VS Code "Reopen in Container" prompt comes from the standard `.devcontainer/` location.

> Order: TS-00 comes first. Create `devcontainer.json` with the `npm ci` step guarded (`[ -f package.json ] && npm ci || true`), so the container builds before TS-02 creates `package.json`.

### TS-01 API spike · S · M0
Check the open points in `architecture.md` §13 with a throwaway script (`scripts/spike.ts`, deleted afterwards) or in the browser console on a GitHub Pages test page.
- [x] `rest.php/v1/page/{title}/html` returns Parsoid HTML with nested `<section>` elements, for `en` and `de`
- [x] CORS works from a `github.io` origin for `rest.php` and `api.php?origin=*`, with the `Api-User-Agent` header
- [x] The summary endpoint to use is decided
- [x] How red links and redirects appear in Parsoid HTML is documented
- [x] `prop=pageviews` is available on `en`, `de` and `fr`
- [x] Findings are written into `architecture.md` §13 and the plan is adjusted if needed

> Note: The script ran from the dev container (`Origin: https://nyfelix.github.io` plus a preflight) instead of a test page, since Pages is set up only in TS-03; TS-03 repeats the check from the live page. The summary endpoint is `action=query&prop=extracts|pageimages|description`, not `/api/rest_v1/page/summary`. Redirect lookups are needed only for links marked `mw-redirect`, and page views need `pvipcontinue`. The affected stories (TS-03, TS-06, TS-08, TS-14, US-05) are adjusted.

### TS-02 Project scaffold · S · M0
- [x] Vite + React 19 + TypeScript (strict), Node 22, npm, all run inside the dev container
- [x] `.nvmrc` / `engines` set to Node 22, so CI and the container match
- [x] ESLint (typescript-eslint, react-hooks, `no-restricted-imports` for the layer rules in `architecture.md` §8) + Prettier
- [x] Vitest with happy-dom, and Playwright installed
- [x] Scripts: `dev`, `build`, `check`, `test`, `e2e`, `fixtures`
- [x] Folder structure from `architecture.md` §8 with placeholder `index.ts` files
- [x] `.gitignore` (node_modules, dist, .DS_Store, test results)
- [x] `src/ui/styles/tokens.css`: colors from `concepts/assets/lens.css` plus `--glass` (light + dark), font tokens from `styleguide.md` §8
- [x] A top-level `README.md` with a short project description and the commands

> Note: TypeScript is pinned to 6.0, because typescript-eslint 8 supports only `<6.1` (TypeScript 7 is out). Scripts in `scripts/` run directly with Node 22 type stripping, so imports keep their `.ts` extension (`allowImportingTsExtensions`, `erasableSyntaxOnly`) and no `tsx` is needed. ESLint also forbids `fetch` outside `src/sources/http.ts`, and DOM globals in `core`, `lenses` and `layouts`. `npm run check` includes `prettier --check`; Markdown documents and `concepts/` are excluded from Prettier. `tokens.css` already has the font stacks from `styleguide.md` §8.

### TS-04 HTTP client and fixture recorder · M · M0
- [x] `src/sources/http.ts`: adds `Api-User-Agent`, adds `origin=*` for `api.php`, allows at most 4 requests in flight, retries on 429/503 with backoff (1 s, 2 s, 4 s), and times out after 15 s
- [x] Typed errors: `NotFound`, `RateLimited`, `Network`, `Unexpected`
- [x] `npm run fixtures -- <lang> "<Title>"` stores the files from `datamodel.md` §9
- [x] The starter set of fixtures from `datamodel.md` §9 is recorded and committed
- [x] Unit tests for the retry and concurrency logic, with a mocked `fetch`

> Note: The client is `createHttpClient()` (injectable `fetch`, `sleep`, limits) plus a shared `http` instance; it returns `{ data, url, status, headers }`, where `url` is the final URL after the 307 from a redirect title. It also maps Action API `error` objects (HTTP 200) to `Unexpected`, or `RateLimited` for `ratelimited`/`maxlag`. A request waiting for a retry frees its slot. The recorder also takes `--starter`, and sends `User-Agent` as well (allowed in Node). The 12 MB of fixtures are marked `linguist-generated` in `.gitattributes`.

### TS-05 Core types and title helpers · S · M1
- [x] `src/core/types.ts` matches `datamodel.md` §1–§6
- [x] `titles.ts`: URL ↔ title, href → target + fragment, and namespace check using siteinfo
- [x] `housekeeping.ts` with the lists from `datamodel.md` §7
- [x] Unit tests: umlauts, parentheses, `#fragment`, `File:` / `Datei:` links, underscores

> Note: `types.ts` adds `Siteinfo` (normalized namespaces), `Article.source` (for TS-07) and `level: 1` for the lead; `datamodel.md` is updated. `sources/siteinfo.ts` (`parseSiteinfo`, `loadSiteinfo`) turns the API response into `Siteinfo`, so `titles.ts` stays pure. `titles.ts` is the single place for title ↔ path encoding; `http.ts` no longer has its own.

### TS-06 Parsoid parser · L · M1
- [x] `parseParsoid(html, ref, siteinfo, domParser): Article` follows the rules in `datamodel.md` §2
- [x] Nested sections become `children` with correct `level`
- [x] Every link has the correct `origin`: body, hatnote, infobox, navbox, template or reference
- [x] Self-links, non-article namespaces and duplicates at the same position are skipped
- [x] Red links (`class="new"`) and links to redirects (`class="mw-redirect"`) are flagged
- [x] The parser spec version is read and a warning is logged when it's newer than tested
- [x] Snapshot tests for all starter fixtures, plus targeted assertions:
  - Mind map has a section "History"
  - a link to Tony Buzan appears in body text
  - navbox links are marked `navbox`
- [x] Parsing the longest fixture (World War II) takes < 150 ms in the test run

> Note: The recorded Mind map revision has no "History" chapter (the first one is now "Origin"), so the test asserts "Origin". The 150 ms budget covers our extraction only: happy-dom needs ~200 ms just to build the World War II DOM, which a browser's native `DOMParser` does much faster; extraction takes ~50 ms (`tests/unit/parsoid.perf.test.ts`, its own worker). Origin rules were refined on the fixtures (`datamodel.md` §2): template output is matched by its shared `about` ID; links that authors wrote into template parameters (`{{div col}}`, `{{annotated link}}`) count as `body`, so "See also" lists aren't lost; de uses its own marker classes (`vorlage-weiterleitungshinweis`, `navileiste`). Sidebars stay `template`. Snapshots are compact outlines (sections, link counts by origin, first body links), not full JSON.

### TS-07 Fallback parser · M · M1
- [x] `parseFallback` builds the same `Article` shape from `action=parse&prop=sections` and per-section `prop=links`. `origin` is always `body`, since this route can't tell where links come from.
- [x] `loadArticle(ref)` uses Parsoid first and the fallback on parser error, and records which one was used
- [x] A test compares both results for "Mind map": same sections, and ≥ 90 % overlap of body links

> Note: Uses `prop=tocdata` (`prop=sections` is deprecated) and requests the sections by `oldid`, so all parts come from one revision. A section's `prop=links` includes its subsections, so each section keeps only the links not found below it. This route can't see redirects, so every link is `redirect: true` and goes through the lookup (TS-08). Links are alphabetical within a section, not in reading order. `loadArticle` falls back only on parser errors; HTTP errors such as `NotFound` pass through. Fallback fixtures exist for en Mind map and de Mindmap; the overlap of body links is 100 % for both.

### TS-08 Redirect resolution · S · M1
- [x] `resolveRedirects(lang, titles)` works in batches of 50 and returns `Map<Title, Title>`. It is called only for link targets flagged `redirect`.
- [x] Leaves are deduplicated after resolution (`Mind-map` and `Mind map` become one)
- [x] Unit tests with a recorded `redirects.json`

> Note: Deduplication is `uniqueLinks(links, redirects, exclude?)` in `src/core/links.ts`, ready for the Chapters lens (M2). It merges links by resolved title in order of first occurrence (real case in the Mind map fixture: `Concept maps` → `Concept map`), and drops links that resolve to the center. `redirectTargets(article)` collects the flagged targets for the lookup. Redirects to a section resolve to the page; `tofragment` is dropped.

### TS-09 Lens registry · S · M2
- [x] `lenses/index.ts` exports `lenses: Record<LensId, Lens>` and `getLens(id)`
- [x] The UI only talks to lenses through this registry, so M5–M7 add a file and one line

> Note: `lenses` is a `Partial<Record<LensId, Lens>>`, because Kinds, Links and Metro aren't built yet; `getLens()` falls back to Chapters, and `LENS_ORDER` lists all four for the lens switch. A matching `layouts/index.ts` registry gives `getLayout()`.

### US-01 See an article as a mind map · L · M2
*As a curious reader, I want to see an article's chapters as branches and its links as leaves, so I get an overview at a glance.*
- [x] `lenses/chapters.ts`: chapters become `group` nodes, subchapters `subgroup` nodes, and links `leaf` nodes, following the rules in `datamodel.md` §4
- [x] Only `body` and `hatnote` links are shown by default
- [x] Each chapter gets a color slot 1–6 in turn. Housekeeping chapters are muted and hidden by default.
- [x] `layouts/mindmapTree.ts` uses `d3-hierarchy` `tree()`:
  - chapters are split between the right and left side, clockwise from the top right, so both sides get a similar number of rows
  - no labels overlap for any starter fixture at density 4 (checked by a unit test that compares label bounding boxes)
- [x] `ui/map/SvgMap.tsx` renders `PositionedMap` as specified in `styleguide.md` §4:
  - center pill
  - level-1 branches and deeper branches as tapered shapes, twigs as thin strokes
  - fold toggles on every node that has children
  - a direction symbol on every leaf (§5; shown as *pending* until M3 loads the data)
  - leaf labels and ⊕
  - same look as `concepts/style-directions.html`
- [x] A dev-only route `/dev/fixture/:lang/:title` renders any fixture

> Note: The lead becomes the first branch, "Introduction" (owner decision); leaves keep reading order. The layout uses `cluster()` from d3-hierarchy instead of `tree()`, because tree compaction lets leaves at different depths share a row and overlap. Column widths follow the widest group label, and labels over 40 characters (52 for leaves) are shortened with "…". Labels get a halo in `--bg` where they cross a branch. Text is measured in the real fonts (canvas `measureText`). ⊕ is drawn wherever recentering is wired up; on the dev route it opens another fixture.

### US-02 Fold and unfold parts · M · M2
*As a student, I want to fold chapters I'm not interested in, so long articles stay readable.*
- [x] Every node with children has a fold toggle (−/+) on its branch point, at every level. Clicking it or pressing Enter toggles it. A folded part shows `+N links`.
- [x] The fold toggle is a shared component in `ui/map/`, so every later lens gets folding for free
- [x] Folding re-runs the layout, and nodes move smoothly (250 ms, none with reduced motion)
- [x] Folded IDs are written to the URL (`fold=`)

> Note: Fold and "+N more" re-flow in 250 ms (`styleguide.md` §7), using a layout-agnostic tween in `ui/map/tween.ts`: nodes are matched by ID and paths interpolated number by number.

### US-03 Control how much is shown · S · M2
*As a reader, I want to choose how many links each part shows, so I can go from overview to detail.*
- [x] A density slider (2–8, default 4) and a "Show See also" toggle
- [x] Parts with more links show a `+N more` node. Clicking it shows **all** links of that one part; the other parts keep the density. The part then shows "Show fewer".
- [x] All settings are written to the URL (`density=`, `hk=`, `more=`)

> Note: "+N more" shows all links of that one group and turns into "Show fewer" (`more=` in the URL, `styleguide.md` §4). Map settings replace the history entry instead of adding one; history is for the trail.

### US-19 Use the whole screen for the map · M · M2
*As a reader, I want the map to fill my screen, so I can see as much of it as possible.*
- [x] The map canvas fills the window. Logo and search, lens switch, trail and map controls float as panels at the edges (`styleguide.md` §2).
- [x] Drag the empty canvas to pan. Wheel, trackpad pinch and `+` `−` zoom around the pointer. `⤢` and `0` fit the map.
- [x] Every new map is fitted to the window automatically, leaving room for the panels
- [x] Works from 1024 px up, and without layout breaks on tablets (768–1023 px)

> Note: The logo, map controls and attribution panels are in place; search and trail come with US-04 and US-08, the lens switch with US-14. Fitting reserves room for the panels (`ui/map/viewport.ts`). The tablet layout was checked by screenshot at 820 × 1180; the Playwright test at that size comes with US-10.

### TS-16 Links-back check · S · M3
- [x] `sources/linksBack.ts`: for the leaf titles of a map, find out which ones link back to the center with `action=query&prop=links&titles=A|B|…&pltitles={center}&pllimit=max`, batched 50 titles per request (see `architecture.md` §4)
- [x] It returns a `Set<Title>` of the titles that link back, and is cached like the other enrichments
- [x] Unit tests with a recorded response; one test checks that continuation (`plcontinue`) is followed

> Note: The check also counts links through the center's redirects (Mind map has 16, such as "Mind-map"): `pltitles` holds the center and up to 49 of them. `redirects=1` resolves leaf titles that are redirects, and results are mapped back to the asked title. `linksback.json` is recorded for every starter fixture (`npm run fixtures -- --linksback-only` re-checks it without re-fetching pages). The continuation test uses a synthetic response, since a live `plcontinue` is rare with `pltitles`. Caching comes with TS-10.

### TS-10 Caching · S · M3
- [x] TanStack Query with an IndexedDB persister, using the keys and lifetimes from `architecture.md` §6
- [x] Going back along the trail makes no network request (verified in an e2e test)
- [x] The app still works when IndexedDB is unavailable
- [x] Leaves whose map is already cached are shown in bold (`styleguide.md` §4)

> Note: One persister per lifetime (`experimental_createQueryPersister` on idb-keyval, structured clones, no JSON round trip). Query data is plain arrays, not Maps, so it persists. Article keys have no revision (see `architecture.md` §6). Links back are merged into one growing entry per article and persisted with `persistQueryByKey`. Without IndexedDB every storage call quietly does nothing; tested in a unit test and an e2e test.

### US-05 Open any article by URL · M · M3
*As a teacher, I want to share a link that opens a specific map, so my class starts at the same place.*
- [x] `/{lang}/{Title}` loads the article live, applying the query parameters from `datamodel.md` §8
- [x] Redirect titles are replaced in the URL by the target title (`/en/Mindmap` becomes `/en/Mind_map`), taken from the final URL after `rest.php`'s 307 redirect
- [x] Unknown titles show "This article doesn't exist on {lang}.wikipedia.org", with a search box
- [x] Loading shows the center immediately and the branches as soon as they're parsed. There's no blank screen.
- [x] Network errors show a message with a retry button
- [x] Loading, not-found and error states look as specified in `styleguide.md` §15

> Note: The 307 from rest.php gives the real title; the URL is then replaced (history `replace`, trail step renamed). Branches appear once the redirects of flagged links are resolved (usually one more request), so leaves don't first show duplicates. `LOADING` appears only after 600 ms. After a network error the last good map stays, dimmed, under the error card. A stub without links in its text switches See also on by itself.

### US-06 Preview a linked article · M · M3
*As a reader, I want a short preview of a leaf before I jump, so I know where I'm going.*
- [x] Clicking or pressing Enter on a leaf label opens the preview card next to it (`styleguide.md` §4). It shows the title, short description, the extract (1–3 sentences), a 64 px thumbnail if there is one, and which chapter the link is in.
- [x] Buttons: "⊕ Make it the center" and "Open on Wikipedia ↗" (opens in a new tab)
- [x] Clicking the center pill shows the article's own summary
- [x] Summaries load when a card opens and are cached. Escape closes the card.

> Note: Focus moves into the card and back to the node on close; a click on the empty canvas also closes it. Red links open a card saying the article doesn't exist yet.

### US-07 Recenter on a leaf · L · M3
*As a curious reader, I want to make any leaf the new center with one tap, so I can wander through Wikipedia.*
- [x] Every leaf has a ⊕ button (a separate focusable control with `aria-label="Make {title} the center"`)
- [x] Recentering navigates to the new URL. The new map animates in, nodes present in both maps move, and the others fade. ≤ 450 ms; none with reduced motion.
- [x] The lens, density and hide/show settings are kept; folds are reset
- [x] Red links (missing articles) look as in `styleguide.md` §4: muted label, dashed ring instead of a direction symbol, no ⊕

> Note: While the next article loads, the map shows the new center alone: the clicked leaf glides into the middle and the rest fades, and the view glides to the new fit; branches fade in when the article arrives (instant from cache). Nodes are matched by ID, or by article for the center and leaves. The 95 % scale of the old map (`styleguide.md` §7) is left out: the moving nodes carry the transition.

### US-08 See and use my trail · M · M3
*As a curious reader, I want to see the path I took and jump back, so I don't get lost.*
- [x] A trail in the bottom-left panel: the `TRAIL` label in mono capitals, then `Mind map › Tony Buzan › Chess`, with the current step highlighted (`styleguide.md` §2)
- [x] Clicking a step goes back to it. Browser back and forward move along the trail.
- [x] Recentering from an earlier step cuts off the later steps
- [x] The trail survives a page reload (`sessionStorage`)

> Note: Steps built in this tab are history entries, so clicking a step goes back through history; the saved trail keeps the steps ahead visible after going back.

### US-17 See the direction of every link · S · M3
*As a curious reader, I want to see at a glance whether a linked article also links back, so I can tell close relatives from passing mentions.*
- [x] Every leaf shows its direction symbol, as specified in `styleguide.md` §5: *out*, *both ways*, or *pending* while loading
- [x] Symbols differ in shape and fill, not only color, and are mirrored on the left side
- [x] The preview card states the direction in words
- [x] The symbol legend sits in the bottom-right controls and in the drawer

> Note: The legend is in the bottom-right controls; the drawer comes with US-18 (M4). Links back also count links through the center's redirects (TS-16).

### US-04 Search for a term · M · M3
*As a reader, I want to type a term and pick from suggestions, so I land on the right article.*
- [x] A search box with suggestions after 2 characters, debounced by 200 ms. Each suggestion shows its title and short description.
- [x] Arrow keys, Enter and Escape work. Choosing a suggestion navigates to `/{lang}/{Title}`.
- [x] Pressing Enter without choosing picks the first suggestion. With no results, the box shows "No article found for '…'".
- [x] `/` focuses the search field from anywhere
- [x] **Start page** (`/`): the full-window map of the article "Mind map" in the reader's language (en *Mind map*, de *Mindmap*, fr *Carte heuristique*; other languages via `langlinks` from en, falling back to en). The search field is focused and highlighted, and the map labels are shown (`styleguide.md` §15).

> Note: The featured-article and random-article links sit in the search list when the field is empty and focused (the start page focuses it). fr.wikipedia has no featured article in the REST feed, so only "Random article" shows there. The language label `EN` is shown; the picker comes with US-09.

### TS-03 CI and deploy to GitHub Pages · S · M0
- [x] A GitHub Action on push to `main`: `npm ci` → `npm run check` → `npm run build` → deploy with `actions/deploy-pages`
- [x] `BASE_PATH` is set for `/wikimindmap-next/`
- [x] `404.html` is a copy of `index.html`, so deep links load the app
- [x] The placeholder page is live on `https://nyfelix.github.io/wikimindmap-next/`, and `/en/Mind_map` on it loads the app instead of GitHub's 404 page
- [x] From the live page, the browser console confirms a `rest.php` and an `api.php` request with `Api-User-Agent` pass CORS (repeats TS-01 from the real origin)

> Note: The workflow is `.github/workflows/deploy.yml`; it also runs `check` and `build` on pull requests, without deploying. `BASE_PATH` comes from the repository name. `404.html` is written by a small plugin in `vite.config.ts`. Pages was enabled by the owner on 2026-10-01; release confirmed by the owner. Checked from the live page: `/en/Mind_map` loads the app (with HTTP status 404, the accepted trade-off in `architecture.md` §7), and `rest.php` and `api.php` requests with `Api-User-Agent` pass CORS from `nyfelix.github.io`. CI also runs the e2e tests.

### DS-01 Choose typography and draw the logo · S · M2
A design decision made together with the owner, before any map is rendered.
- [x] The owner picks a direction in `concepts/style-directions.html` (or a new candidate)
  > Note: Option 3, Editorial + graphic logo.
- [x] `styleguide.md` §8 records the faces, weights, fallback stacks (including non-Latin scripts) and the licence
- [x] The chosen fonts (all OFL) are subset and self-hosted as WOFF2 in `public/fonts/`, with the weights and budget from `styleguide.md` §8
  > Note: Bundled from the `@fontsource` packages instead of `public/fonts/`: still self-hosted WOFF2, already subset by `unicode-range`, ~128 kB for the five Latin files.
- [x] The logo mark and wordmark are drawn to match (`styleguide.md` §9) and exported as `public/logo.svg` and `public/favicon.svg`
  > Note: Drawn by `scripts/build-logo.ts` (wordmark outlined from Bricolage Grotesque 800). After the owner's review: the organic mark of the Option 3 preview, at 1.15 × the cap height. Approved by the owner on 2026-10-01.
- [x] `src/ui/styles/tokens.css` is updated with all five font tokens: `--logo`, `--display`, `--label`, `--ui`, `--mono`

### US-18 Understand how the map is built · M · M4
*As a first-time visitor, I want the map to explain itself, so I understand what branches, leaves and symbols mean without reading a manual.*
- [x] **Map labels:** 4–5 callouts pinned to real elements of the current map, with the copy from `styleguide.md` §3. Shown the first time a lens is opened; `?` toggles them; "Got it" hides them.
- [x] **Drawer "How this map is built"** (`i`): the construction steps, the symbol legend, what is hidden and why, the source line (article URL and revision), and a link to the help page "How lenses work"
- [x] Each lens provides its own explanation text through the lens registry (`datamodel.md` §4, `explain`)
- [x] Callouts reposition on pan, zoom and resize, and stay inside the window
- [x] Whether the labels were seen is remembered per lens (`localStorage`, wrapped in try/catch)

> Note: Callouts are placed by a pure function (`ui/map/callouts.ts`) next to the first matching element on the map, and follow every pan, zoom, resize and animation frame. A copy for screen readers sits next to them. The drawer's source line links the exact revision.

### US-20 See the lenses that are coming · S · M4
*As a curious reader, I want to see that there are other ways to look at an article, so I come back when they arrive.*
- [x] The lens switch in the top-right panel shows Chapters (active) and Kinds, Links and Metro marked "soon" (`styleguide.md` §2)
- [x] "Soon" lenses can't be selected. Hover or focus shows a one-line description, and clicking one opens the help page "How lenses work" at that lens.
- [x] Each later milestone (M5–M7) turns one lens from "soon" into selectable, by registering it in the lens registry

> Note: "Soon" lenses are links to `/help/lenses#{lens}`, with the description as a tooltip on hover and focus. A lens becomes selectable as soon as it is registered in `lenses/index.ts`; switching lenses keeps the center and the trail and resets folds (`setLens`).

### US-12 Know what this is · S · M4
*As a first-time visitor, I want to understand the idea and its history.*
- [x] An "About" page: the idea, the 2007 history, a link to the old repo and to Wikipedia, and a note on data sources and licenses (Wikipedia content is CC BY-SA)
- [x] Editorial pages (About, help) follow `styleguide.md` §14: grey background, reading column, Bricolage headings, Zilla Slab body, capital eyebrows and breadcrumbs
- [x] Each map shows the attribution "Content from Wikipedia, CC BY-SA" with a link to the article, as a small line under the bottom-right controls (`styleguide.md` §2)
- [x] Clicking the logo opens a small menu: About, How lenses work, GitHub. Editorial pages link back to the map.
- [x] The About page and the README state: "WikiMindMap is an independent project and is not affiliated with or endorsed by the Wikimedia Foundation. Wikipedia is a trademark of the Wikimedia Foundation."
- [x] Nothing in the app suggests it's an official Wikipedia service: no Wikipedia or Wikimedia logos, and "Wikipedia" never appears in the product name, logo or domain

> Note: The About copy was drafted from the original repository's README (PHP, the adapted FreeMind Flash browser by Juan Pedro de Andres, GPL) and is waiting for the owner's review. Editorial pages are separate chunks that load Bricolage Grotesque 700/800 and Zilla Slab 400 themselves.

### US-09 Choose the Wikipedia language · S · M4
*As a German-speaking reader, I want maps from de.wikipedia.org.*
- [x] A language picker inside the search panel (`EN ▾` in mono capitals, `styleguide.md` §2). The initial choice is the browser language if a wiki exists for it, otherwise `en`.
- [x] Switching language on a map offers the same article in the other language, if it exists (using `langlinks`)
- [x] Housekeeping lists work for `en`, `de` and `fr`

> Note: The picker lists every open Wikipedia from the site matrix (348 on 2026-10-01; owner decision), the 20 largest first, filterable by code, own name or English name. Switching on a map opens the langlinked article as a new trail step; without one, a card says so and search moves to that language. The start page uses the first browser language: en, de and fr have a known start article, others get "Mind map" through langlinks, and fall back to English if there is none.

### US-11 Read the map without seeing it · M · M4
*As a screen-reader user, I want the map as a structured list, so I can use the same features.*
- [x] `OutlineView` renders the same `MapGraph` as nested lists, with the same preview and recenter buttons
- [x] An outline toggle: an icon button next to `?` and `i`, shortcut `o` (`styleguide.md` §2). Screen readers get the outline first (skip link).
- [x] The outline shows the direction of each link in words ("links both ways")
- [x] The whole flow works with keyboard only: search → map → preview → recenter → trail. Arrow keys move between nodes on the map (along branches, and between siblings).
- [x] An axe-core check in Playwright shows no serious issues

> Note: The outline is a floating panel next to the map (the map stays, so cards and recentering work the same); a skip link at the start of the page opens it. Arrow keys follow the positioned nodes, so they work in every layout (`ui/map/navigation.ts`). The axe-core checks cover the map with labels, the outline, the drawer and the About page. While doing this, the preview card was fixed to take focus once it is placed.

### US-10 Use it on a tablet · S · M4
*As a reader on a tablet, I want the map to work with touch.*
- [x] 768–1023 px: panels shrink and the lens switch becomes a menu
- [x] Touch: drag to pan, pinch to zoom; tap targets ≥ 44 × 44 px
- [x] One Playwright test at 820 × 1180
> Phones (< 768 px) are nice to have and not part of the MVP; see "Later".

> Note: On touch screens (`pointer: coarse`) leaf rows are 44 px apart (layout option `row`), and fold, ⊕ and leaf hit areas are divided by the zoom, so they stay 44 × 44 px on screen; zoomed far out they overlap, and the top one wins. The lens switch is a menu below 1024 px. Text autosizing is switched off, so labels are measured as drawn. Tested at 820 × 1180 with touch.

### TS-13 Kind mapping table · M · M5
- [x] `scripts/build-kind-map.ts` queries Wikidata SPARQL for the ~1,000 most common P31 classes of articles and walks their P279 superclasses to one of the six kinds. It writes `lenses/kindMap.json` (QID → kind).
- [x] Rules from the preview: humans and fictional characters → people; organizations → orgs; creative works and software → works; events → events; geographic features → places; anything else → concepts
- [x] The table is checked in and regenerated manually (documented in `README.md`)

> Note: The ~1,000 classes are sampled from the P31 values of every link in the recorded starter articles (the classes real maps meet), plus seeds, instead of a Wikidata-wide count, which times out on the query service. The table stores `[kind, English label]`; the label is the "instance of" in the preview card. Event roots are specific (historical event, conflict, battle, election, festival…): the broad "occurrence" pulled in currency, hobby and contract. When a class reaches several roots, precedence is people, places, orgs, works, events. Result: people 6, places 262, orgs 170, works 89, events 62, concepts 411.
