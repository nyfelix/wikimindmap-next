# Concepts

Visual previews for the WikiMindMap relaunch. These are throwaway prototypes for comparing ideas, not app code.

## Style directions

[style-directions.html](style-directions.html) is a full-window mock of the final app: the floating panels, map labels (`?`), the "How this map is built" drawer (`i`), fold toggles, direction symbols, pan and zoom. The dark switcher at the bottom compares four typography directions; "Specimen" shows the details and licences. The decision goes into `../styleguide.md`.

## Lens previews

A *lens* decides how the links of an article are grouped into branches. The original WikiMindMap (2007) grouped them by the article's chapters. The previews show the original and three alternatives, all using the same interaction: tap a label for a preview, tap ⊕ to make that article the new center.

| File | Lens | Branches come from |
|---|---|---|
| [lens-chapters.html](lens-chapters.html) | Chapters (2007 original) | The article's own outline: chapters as branches, subchapters as sub-branches, links as leaves. Parts fold and unfold. |
| [lens-kinds.html](lens-kinds.html) | Kinds | The Wikidata "instance of" of each linked article, sorted into six fixed branches: People, Organizations, Works, Concepts, Events, Places. Dot size = monthly page views. |
| [lens-links.html](lens-links.html) | Links in / out | Link direction: articles that link *here* (left), articles this one links *to* (right), and links that go *both ways* (top band). |
| [lens-metro.html](lens-metro.html) | Metro | The article as a line map in reading order, one station per chapter. Each colored line is a linked article that recurs in several chapters and stops where it is mentioned. |

Shared files:

- `assets/lens.css`: colors, type and layout shared by the previews (light and dark)
- `assets/lens-common.js`: SVG helpers, trail, preview card and recenter logic
- `assets/sample-data.js`: three hand-written sample articles (Mind map, Tony Buzan, Concept map), with links and a simplified chapter outline

The sample titles are real Wikipedia articles, but the kinds, view counts, link directions, totals and chapter outlines are **illustrative**. The real app would read them from Wikidata, the Pageviews API and the MediaWiki `links` / `linkshere` APIs.

## Open

Open the HTML files directly in a browser, or serve the folder:

```bash
python3 -m http.server 8765 --directory concepts
```
