# CLAUDE.md

Guidance for Claude Code (terminal or VS Code) working in this repository.

## Project

**WikiMindMap 2027** is the relaunch of wikimindmap.org (2007). You type a term, the Wikipedia article becomes the center of a mind map, and its links become nodes. Tapping ⊕ on a node makes it the new center, so people browse the encyclopedia as a map.

The relaunch adds switchable **lenses**: different ways to group an article's links into branches. The MVP ships the original **Chapters** lens. **Kinds**, **Links in / out** and **Metro** follow one by one.

The original source is at https://github.com/nyfelix/wikimindmap (reference only, not reused).

## Documents (read before changing code)

| File | What it holds |
|---|---|
| `architecture.md` | Stack, module boundaries, data sources, key decisions and why |
| `datamodel.md` | TypeScript types: article model, lens contract, map graph, layout, URL state |
| `styleguide.md` | Layout, map elements, direction symbols, color, typography, logo, motion. **Read before any UI work.** |
| `userstories.md` | Milestones, user stories with acceptance criteria, and technical tasks. **This is the plan.** |
| `concepts/` | Clickable HTML previews of all four lenses, and `style-directions.html` (the full-window UI and the type candidates). Visual and interaction reference, not app code |

When a decision changes, update the matching document in the same commit.

## How to work in this repo

1. Find the **first milestone in `userstories.md` that isn't done**, and the first story in it that isn't checked off.
2. Read the parts of `architecture.md` and `datamodel.md` the story touches.
3. For anything larger than a small fix, propose a short plan first and wait for approval.
4. Write or update tests first where the story has pure logic: parsing, lenses, layouts.
5. Implement, run `npm run check` (types, lint, unit tests), and fix everything it reports.
6. Tick the story's checkboxes in `userstories.md`, add a one-line note under it if something differs from the plan, and move the finished story to **Implemented** at the end of the file.
7. Commit using Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), one story per commit where practical.

Stop and ask when a story is ambiguous, when an acceptance criterion can't be met, or when a Wikipedia API behaves differently from what `architecture.md` says.

## Environment

Development runs in a **VS Code dev container** (`.devcontainer/`, see `architecture.md` §14). Run all commands in the container terminal, not on the host. If a tool is missing, add it to `.devcontainer/devcontainer.json` and rebuild; don't install it by hand in the running container.

## Commands

These are set up in milestone M0. Until then they don't exist.

```bash
npm install          # install dependencies (done automatically when the container is created)
npm run dev          # dev server at http://localhost:5173
npm run check        # typecheck + lint + unit tests (run before every commit)
npm test             # unit tests (Vitest), watch mode: npm test -- --watch
npm run e2e          # Playwright tests against the built app with mocked network
npm run build        # production build into dist/
npm run fixtures -- en "Mind map"   # record real API responses into tests/fixtures/
```

## Rules

**Architecture**
- `src/core`, `src/lenses` and `src/layouts` are **pure TypeScript**: no React, no `fetch`, no DOM globals. They take data and return data. `src/sources/parsoid.ts` is the only exception, because it needs a `DOMParser`, which is passed in.
- Only `src/sources/*` talks to the network. Only `src/ui/*` uses React.
- A new lens = one file in `src/lenses/`, registered in `src/lenses/index.ts`, plus a layout if no existing one fits. It must not need changes elsewhere.
- The Parsoid HTML format is known **only** to `src/sources/parsoid.ts`.

**Wikipedia APIs**
- Send the `Api-User-Agent` header from `src/sources/http.ts` on every request. Never bypass that client.
- Batch title lookups (50 per request). Keep at most 4 requests in flight at once.
- Tests **never** hit the live API. Use `tests/fixtures/` (record new ones with `npm run fixtures`).
- Handle every API failure visibly: a message in the UI, never a blank map.

**Code**
- TypeScript `strict`. No `any` without a comment saying why.
- Name things by what users see (`trail`, `lens`, `branch`, `leaf`), matching `datamodel.md`.
- Keep components small. Map rendering lives in `src/ui/map/`.
- No new dependency without a reason in the commit message. Check `architecture.md` first; it lists what is already chosen.

**Design** (details in `styleguide.md`)
- The map fills the window; all chrome floats in small panels at the edges. Don't add permanent sidebars or headers.
- Every node with children can fold, in every lens. Every leaf shows a direction symbol (out / both ways / in), distinguished by shape, not only color.
- Explanations (map labels and "How this map is built") are part of the product. A new lens isn't done without its explanation copy.
- Colors, fonts and spacing come from CSS custom properties in `src/ui/styles/tokens.css`, taken from `concepts/assets/lens.css`. Never hard-code a color in a component.
- Every color exists in light and dark. Test both.
- Branch colors are the multi-color palette (`--b1`…`--b6`). Keep it colorful; the owner likes this.
- Fonts are only ever referenced through `--logo`, `--display`, `--label`, `--ui` and `--mono`. The choice is decided: Bricolage Grotesque (logo), Zilla Slab (display), Fira Sans (labels and UI), Fira Mono (capital labels). See `styleguide.md` §8.
- Small labels are tracked capitals in `--mono` (eyebrows, the trail label, zone labels, counts). Editorial pages (About, help) use the grey background and reading-column style of the first concept page (`styleguide.md` §14).
- The recenter gesture (⊕) and its animation are the heart of the product. Don't simplify them away.
- Everything must work with keyboard only. Desktop first (≥ 1024 px); tablets must work; phones are nice to have.

**Don't**
- Don't edit files in `concepts/` unless asked. They document decisions already taken.
- Don't add a backend, accounts or analytics in the MVP.
- Don't use AI or LLM calls in the MVP.
- Don't copy article text into the repository beyond test fixtures.

## Status

- Concept and lens previews: done (`concepts/`)
- M0–M3 are done (confirmed by the owner). Current milestone: **M4 – MVP polish and relaunch**, then M5 (see `userstories.md`)
- Live at https://nyfelix.github.io/wikimindmap-next/ (deployed from `main` by GitHub Actions)
- The host needs only Docker (Docker Desktop or OrbStack) and VS Code with the Dev Containers extension. Node lives in the container. TS-00 creates it.
