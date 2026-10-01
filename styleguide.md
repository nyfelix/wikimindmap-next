# Style guide

How WikiMindMap looks and behaves on screen. `architecture.md` says how it's built, `datamodel.md` what the data looks like, and this file what the reader sees.

**Status:** layout, map elements, direction symbols, color and typography are decided. Typography is **Option 3, Editorial + graphic logo** (§8). Editorial pages follow the first concept page (§14). **Still open:** the owner's review of the logo draft (§9, DS-01).

## 1. Principles

1. **The map is the product.** It fills the whole window. Everything else floats above it, small, at the edges.
2. **Explained, but only on demand.** Every map can explain how it was built, in place, without permanent sidebars.
3. **Colorful and hand-made.** Multi-colored branches in the tradition of hand-drawn mind maps. Never grey corporate diagrams.
4. **Artistic typography.** The type gives WikiMindMap its personality: expressive for the logo, center and branch names; calm and legible for leaves and interface.
5. **Honest about the data.** Every symbol means something that comes from Wikipedia. No decoration that looks like information.
6. **Desktop first.** Designed for a large screen with mouse and keyboard. Tablets work; phones are nice to have (§13).

## 2. Screen layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo▾ | EN▾ search…  /]      [Chapters Kinds· Links· Metro·][?][i][≡]│
│                                                                        │
│                                                        ┌────────────┐ │
│                  full-window map canvas                │ How this   │ │
│              (drag to pan, wheel/+− to zoom)           │ map is     │ │
│                                                        │ built  (i) │ │
│                                                        └────────────┘ │
│ [TRAIL  Mind map › Tony Buzan]       [Links ─●─ 4 ☐ See also | → ⇄ | + − ⤢]│
│                                        CONTENT FROM WIKIPEDIA · CC BY-SA │
└──────────────────────────────────────────────────────────────────────┘
```

| Area | Content | Notes |
|---|---|---|
| Canvas | The map, full window | Background `--bg`. Drag the empty canvas to pan; wheel, trackpad or `+` `−` to zoom; `⤢` fits the map to the window. Every new map is fitted automatically. |
| Top left | Logo, language, search | Clicking the logo opens a small menu: About, How lenses work, GitHub. The language picker `EN ▾` sits in the search panel, in mono capitals. The search field expands with suggestions while typing. `/` focuses it. |
| Top right | Lens switch, `?` (label the map), `i` (how this map is built), `≡` (outline view, `o`) | Segmented control. The active lens is raised. Lenses that aren't built yet are shown with a small `SOON` in mono capitals, in `--muted`. They can't be selected: hover shows a one-line description, and a click opens the help page at that lens. |
| Bottom left | Trail | Chapter-style breadcrumb. Clicking a step goes back to it. |
| Bottom right | Map controls: density, See also, direction legend, zoom | Only the controls the active lens uses. |
| Under bottom right | Attribution | `CONTENT FROM WIKIPEDIA · CC BY-SA` in mono capitals, `--muted`, linking to the article. Always visible. |
| Right drawer | "How this map is built" | 340 px, floats above the map, closed by default. |
| Preview card | Next to the node that was clicked | 300 px. Stays inside the window. Closes with `Esc` or a click on the canvas. A thumbnail, if there is one, sits top right at 64 × 64 px with an 8 px radius. |

**Floating panels:** `--glass` background (translucent paper) with a backdrop blur, 1 px `--line` border, 14 px radius, soft shadow, 14 px from the window edge. Panels never cover more than about 12 % of the window together, with the drawer closed.

## 3. Explanations

The explanations from the concept previews stay in the product, in three layers. None of them takes permanent space.

| Layer | Trigger | Content |
|---|---|---|
| **Map labels** (callouts) | Shown automatically the first time a reader opens a lens. `?` toggles them afterwards. | 4–5 dark callouts pinned to real elements of the current map: the article, a chapter, a subchapter, a direction symbol, ⊕. A bar at the top says "Labels explain the map. [Got it]". |
| **How this map is built** (drawer) | `i` | Per lens: the construction steps as a numbered list (a real sequence), the symbol legend, what is hidden and why, and the source line (article URL, revision). A button to show the map labels. |
| **Preview card** | Click on a node | The chapter the link sits in, the direction in words ("Links go both ways"), and the summary. |

Callout copy is written per lens, and pinned to the element it describes. For Chapters:

| Element | Title | Text |
|---|---|---|
| Center | The article | The Wikipedia article you're exploring. Tap it for its summary. |
| Chapter | A chapter: {name} | Each chapter heading becomes a branch. Tap − to fold it. |
| Subchapter | A subchapter | Deeper levels get thinner branches and fold on their own. |
| Direction symbol | Link direction | → this article links there. ⇄ that article links back too. |
| ⊕ | Recenter | Tap ⊕ to make this article the new center of the map. |

Whether a reader has seen the labels is remembered per lens in `localStorage`. If storage isn't available, the labels are shown again, which is harmless.

## 4. Map elements

| Element | Look | Behavior |
|---|---|---|
| **Center** | Pill in `--ink` with the title in `--paper`, display face, 24 px | Click: summary card |
| **Branch (level 1)** | 14 → 5 px wide, in the group color. Tapered (filled shape) in organic styles, a round-capped stroke otherwise. | — |
| **Branch (level 2+)** | 6 → 2.5 px | — |
| **Twig to a leaf** | 1.8 px, 80 % opacity | — |
| **Fold toggle** | 16 px circle on the branch point: `--paper` fill, 2 px group-color ring, `−` when open, `+` when folded | Click or Enter toggles. A folded node shows `+N links` in muted text next to it. |
| **Group label** | Display face, 18 px (level 1) / 14.5 px (level 2), above the branch end, on the side away from the center | — |
| **Leaf** | Direction symbol (§5), then label in the label face, 14.5 px. Bold when a map for it is already cached. | Click: preview card |
| **Recenter ⊕** | 18 px circle after the label, `--accent-soft` fill, `--accent` ring and cross. Filled `--accent` on hover. | Click: recenter |
| **More** | `+N more` in muted text | Shows all links of that one group; the others keep the density. The group then ends with "Show fewer". Kept in the URL (`more=`). |
| **Red link** (missing article) | Label in `--muted`; a dashed 13 px ring instead of a direction symbol; no ⊕ | Click: a card saying the article doesn't exist yet on Wikipedia |

**Hierarchy rule:** in **every lens**, every node that has children can be folded. That covers chapters, subchapters, kinds branches and metro lines with stations. Folding works with mouse and keyboard, the state is kept in the URL (`fold=`), and the layout re-flows smoothly.

## 5. Direction symbols

Every leaf in every lens shows the direction of its link. The meaning is carried by **shape, fill and arrow**, never by color alone.

| Symbol | Shape | Meaning | Where it appears |
|---|---|---|---|
| **Out** | Solid dot (13 px) in the group color, white arrow pointing away from the center | This article links there; that one doesn't link back | All lenses |
| **Both ways** | Solid capsule (18 × 12 px) in the group color, white double arrow | The two articles link each other | All lenses |
| **In** | Hollow ring (13 px) with a 2 px group-color outline, arrow in the group color pointing toward the center | That article links here, but this one doesn't link to it | Links in / out lens (other lenses only show links that are in the article) |
| **Pending** | Hollow ring without an arrow | Direction not yet checked | Briefly, while the check loads |

The arrow is mirrored on the left side of the map so it always points away from (out) or toward (in) the center.

Symbols always keep their fixed size. Where a lens ranks by page views (Kinds, Links in / out), popularity is shown as a thin bar (3 px, the group color at 25 % opacity) behind the label, as long as the label at most, and as a number in the preview card.

Data: see `architecture.md` §4 ("Links back"). For Chapters, every leaf starts as *pending* and becomes *out* or *both ways* once the batch check returns.

## 6. Color

The tokens come from `concepts/assets/lens.css`, in light and dark.

| Token | Use |
|---|---|
| `--bg` | Canvas background (cool, slightly blue-grey paper; not cream) |
| `--paper` | Panels, cards, fold toggles, text on dark |
| `--ink` | Text, center pill, callouts |
| `--muted` | Secondary text, housekeeping branches, counts |
| `--line` | Borders, dividers |
| `--accent` / `--accent-soft` | Interactive things: ⊕, primary buttons, links, active controls |
| `--glass` | Floating panels (translucent `--paper`) |
| `--b1` … `--b6` | Branch colors: teal, amber, raspberry, violet, green, blue. Assigned in turn to level-1 groups. Deeper levels inherit their parent's color. |

Rules:
- Branch colors are used only on the map: branches, dots and direction symbols. Interface controls use `--accent`.
- More than six groups: colors repeat. The first and seventh never sit next to each other, because the sides alternate.
- Housekeeping groups ("See also"…) use `--muted`.
- Text on the canvas is `--ink` (leaves) or `--muted` (counts). Branch colors never color text, which keeps contrast legible in both themes.

## 7. Motion

| Moment | Motion | Duration |
|---|---|---|
| Recenter | Old map fades and scales to 95 %. The new map is fitted and fades in. Nodes present in both maps move to their new place (M3). | 450 ms total |
| Fold / unfold | Nodes glide to their new rows; new leaves fade in | 250 ms |
| Panels, cards, drawer | Fade and 4 px rise | 150 ms |
| Pan and zoom | Direct, no easing (follows the pointer) | — |

With `prefers-reduced-motion`, everything jumps directly to the end state.

## 8. Typography

Roles, always referenced through tokens, so the choice can change without touching components:

| Token | Role | Used for |
|---|---|---|
| `--logo` | Brand | The wordmark. Also headings on editorial pages (§14). |
| `--display` | Personality | Center, group labels, card and drawer titles |
| `--label` | Map legibility | Leaf labels |
| `--ui` | Interface | Search, buttons, controls, body text in cards and drawer |
| `--mono` | Labels in capitals, data | Eyebrows, the `TRAIL` label and breadcrumbs, zone labels ("LINKS HERE · 1,240"), counts, revision and source lines |

**Capitals:** small labels are set in `--mono`, uppercase, 0.68–0.78 rem, letter-spacing 0.06–0.08 em, in `--muted`. They name things (a section, a zone, the trail) and never hold running text. This play of small tracked capitals against the large display type is part of the WikiMindMap look, in the app and on editorial pages.

**Type scale (map units at zoom 1):** center 24, level-1 group 18, level-2 group 14.5, leaf 14.5, counts 12.5. The interface uses 0.8–0.95 rem, with drawer titles at 1.35 rem.

### Candidates

Round 1 compared four directions (Soft Slab, Editorial Slab, Deco Slab, Casual Recursive). The owner preferred **Editorial Slab**. Round 2, now in `concepts/style-directions.html`, compares three variants of it (switcher at the bottom, "Specimen" for details):

| Option | Logo | Display | Labels / UI | Branches | Watch out |
|---|---|---|---|---|---|
| **1 · Editorial Slab** | Zilla Slab, italic *Mind* | Zilla Slab 600–700 | Fira Sans 400–600 | Straight, round-capped | — (reference) |
| **3 · Editorial + graphic logo** | Bricolage Grotesque 800, `WikiMindMap`, tight, all ink | Zilla Slab 600–700 | Fira Sans 400–600 | Tapered | Three families; the logo can ship as an SVG outline, so Bricolage isn't downloaded |
| **5 · Screen Slab** | Bitter 800 | Bitter 700–800 | Schibsted Grotesk 400–700 | Straight | Schibsted is Latin only, so non-Latin labels fall back to system fonts |

Other candidates discussed but not mocked:
- Bricolage Grotesque + Fira Sans
- IBM Plex Serif + Plex Sans (best script coverage)
- Aleo + Hanken Grotesk
- Syne + Figtree
- Atkinson Hyperlegible Next as a label face
- Fontshare (Zodiak or Gambetta + Satoshi or General Sans)

Paid upgrades:
- Tisa + Tisa Sans (the natural final form of Editorial Slab)
- FF Meta Serif + FF Meta
- Adelle + Adelle Sans
- Museo Slab + Museo Sans

**Decision criteria**
1. Leaves are still legible at 12 px (zoomed out) in the label face.
2. It has character at 18–40 px in the display face.
3. **Script coverage:** labels come from every Wikipedia language. The label face must cover at least Latin Extended. The fallback stack must cover Cyrillic, Greek, Arabic, Hebrew and CJK gracefully (system fonts). *Fira Sans* covers Cyrillic and Greek. Solway, Zilla Slab and Josefin are Latin only, which is fine for display but worth weighing for labels.
4. License: open (OFL) preferred. A commercial face needs a web licence that allows self-hosting on GitHub Pages.
5. Weight: ≤ 150 kB of font files on the map screen. Fira Sans and Fira Mono count as one family; Bricolage is loaded only on editorial pages.

### Decision: Option 3, Editorial + graphic logo

Chosen by the owner after round 2.

| Token | Face | Weights | Fallback stack |
|---|---|---|---|
| `--logo` | Bricolage Grotesque | 800 (logo); 600–800 (editorial headings) | `"Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif` |
| `--display` | Zilla Slab | 700, italic 700 (map and app); 400 (editorial body text, editorial pages only) | `"Zilla Slab", Georgia, "Noto Serif", serif` |
| `--label`, `--ui` | Fira Sans | 400, 600 | `"Fira Sans", system-ui, "Noto Sans", "Segoe UI", sans-serif` |
| `--mono` | Fira Mono | 500 | `"Fira Mono", ui-monospace, "SFMono-Regular", Menlo, monospace` |

The map screen loads five files (Zilla 700 and italic 700, Fira Sans 400 and 600, Fira Mono 500), about 130 kB subset. Level-2 group labels use Zilla 700 at the smaller size; there's no 600 weight.

- **Branches** are tapered (filled shapes), as in the Option 3 mock.
- **Licence:** all four faces are OFL. They are self-hosted as WOFF2, bundled by Vite from the `@fontsource` packages (imported in `src/main.tsx`). Each face is split into subsets by `unicode-range` (Latin, Latin Extended, and Cyrillic and Greek for Fira Sans), so a page downloads only the subsets its text uses: about 128 kB for Latin.
- **Loading:** the app loads Zilla Slab, Fira Sans and Fira Mono. The wordmark is an SVG outline, so Bricolage is only loaded on editorial pages.
- **Non-Latin labels:** Fira Sans covers Cyrillic and Greek. Arabic, Hebrew, Devanagari and CJK use the system fonts in the fallback stack.
- **Paid upgrade later (optional):** Tisa + Tisa Sans (Typotheque) could replace Zilla Slab + Fira Sans without changing the character.

## 9. Logo

- **Mark:** a dark center with four **tapered** branches radiating out in `--b1`–`--b4`, drawn like the tapered map branches. It's the map itself in miniature.
- **Wordmark:** `WikiMindMap` (capital W, M, M), Bricolage Grotesque 800, letter-spacing −0.035 em, **entirely in `--ink`**: black in the light theme, near-white in the dark theme. There's no colored highlight; the color comes from the mark.
- **Lockup:** mark left of the wordmark, gap = 0.3 × wordmark height, mark height = 1.15 × cap height of the wordmark (owner: the mark should hold its own next to the type), centred on the cap height. Also a stacked version (mark above) for square spaces.
- **Favicon and app icon:** the mark alone, on `--paper` (light) or `--bg` dark.
- **Drawn in DS-01** by `scripts/build-logo.ts`: the mark (the organic mark of the Option 3 preview: four branches, wide at the center and curving out to a point, in `--b1`–`--b4` clockwise from the top left, around an `--ink` center) and the wordmark converted to outlines. It writes `public/logo.svg`, `public/favicon.svg` and `src/ui/brand/logoArt.ts` (the app draws the logo inline, in the theme's colors). Checked at 16, 30 and 120 px in light and dark; awaiting the owner's review.

## 10. Controls and icons

- **Buttons:** pill-shaped (999 px radius). The primary button is filled `--accent`; secondary buttons are `--bg` with a `--line` border. Icon buttons are 36 px square with a 10 px radius.
- **Segmented control** for the lens switch: the active segment is raised on `--paper` with a small shadow.
- **Icons:** drawn as simple SVG strokes at 1.6 px (⊕, fold, zoom). No icon font and no emoji.
- **Keyboard shortcuts:**
  - `/` search
  - `?` map labels
  - `i` how this map is built
  - `o` outline view
  - `+` `−` zoom, `0` fit
  - `Esc` closes whatever is open
  - Arrow keys move between nodes (M4)

## 11. Voice and copy

- Plain words from the reader's side: *chapter*, *link*, *branch*, *center*, *trail*. Not *node*, *edge* or *lens graph* in the interface. *Lens* is the one invented term, and it's explained in the drawer.
- Buttons say what happens: "Make it the center", "Open on Wikipedia ↗", "Got it".
- Errors say what happened and what to do: "Wikipedia didn't answer. Try again".
- Numbers use the reader's locale (`1,240` / `1’240`).

## 12. Accessibility

- Text contrast is at least 4.5 : 1 in both themes. Branch colors are checked against `--bg` for the symbols (3 : 1).
- Every interactive map element is focusable, with a visible focus ring.
- Direction symbols never rely on color alone (§5).
- An outline view (nested lists) offers the same map for screen readers (US-11).

## 13. Screen sizes

| Width | Support |
|---|---|
| ≥ 1280 px | Primary target. Everything as described above. |
| 1024–1279 px | Full support. The drawer overlaps more of the map. |
| 768–1023 px (tablet) | Works: panels shrink, the lens switch becomes a menu. |
| < 768 px (phone) | Nice to have: map plus search and trail only; the preview card becomes a bottom sheet. Not a release requirement. |

## 14. Editorial pages

Pages to read rather than to use: **About**, the project story, help ("How lenses work"), the changelog, and later perhaps short articles. They follow the look of the first concept page (the original mockup), not the full-window map.

**Look**
- **Background:** the same cool grey `--bg` as the map canvas. Content sits directly on it. `--paper` cards with a 1 px `--line` border and a 10 px radius are used only for things that stand apart: comparisons, facts, a "then and now" pair.
- **Reading column** of about 68 characters, left-aligned, inside a 1,120 px page. Grids of cards may use the full page width.
- **Headings:** `--logo` (Bricolage Grotesque) 800, tight (−0.02 em), with `text-wrap: balance`. H1 is 2.2–3.9 rem, fluid; H2 is 1.6–2.2 rem.
- **Lede:** the first paragraph is larger (1.2 rem) and in `--muted`.
- **Body text:** `--display` (Zilla Slab) 400 at 1.075 rem, line-height 1.6. This gives editorial pages a book-like voice that's different from the interface.
- **Capitals:** every section starts with an eyebrow in `--mono` capitals (e.g. `THEN AND NOW`, `ANATOMY OF A MAP`, `OPEN DECISIONS`). Eyebrows name the section; they aren't numbered unless the content is a real sequence.
- **Breadcrumbs** at the top of the page, in the same style as the map's trail: a `--mono` capital label (`TRAIL` in the app, `WIKIMINDMAP ›` on editorial pages), then the path in `--accent` with the current page in `--ink`.
- **Small diagrams** in the branch colors explain concepts inline: map anatomy, lens sketches, direction symbols. Draw them with the same components as the map, so they always match it.
- **Header:** the logo lockup and a text navigation (`About · Lenses · Help · GitHub`), with no panel background. A link back to the map is always visible.

**Don't**
- no full-width hero images
- no centered layouts for body text
- no second accent color: branch colors belong to diagrams, `--accent` to links

## 15. States

Every state keeps the full-window canvas and the floating panels. Only the canvas content changes.

| State | What the reader sees |
|---|---|
| **Start page** (`/`) | The map of "Mind map" in the reader's language, fitted to the window. The search field is focused and highlighted with a 2 px `--accent` ring and the placeholder "Search Wikipedia…". The map labels (§3) are shown, as on any first visit. |
| **Loading** | The center pill appears at once with the title from the URL. Branches draw in as soon as the article is parsed. Leaves start with *pending* direction symbols (§5). If nothing has appeared after 600 ms, a small `LOADING` in mono capitals pulses under the center. |
| **Not found** | The canvas shows a single muted, dashed center ring with the title, and a floating card: "This article doesn't exist on {lang}.wikipedia.org", with suggestions from search and the search field focused. |
| **Network error** | The last good map stays visible and dimmed (50 % opacity). A floating card in the center: "Wikipedia didn't answer. [Try again]". |
| **No links** | The center alone, with a card: "This article has no links to other articles in its text." For stubs, `See also` is switched on automatically if it has links. |
| **Lens not available** (a "soon" lens clicked) | The help page "How lenses work", opened at that lens |

