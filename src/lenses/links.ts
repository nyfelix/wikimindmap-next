/**
 * Links in / out lens (US-15): the map split by link direction (concepts/lens-links.html).
 * Articles that link here are on the left, articles this one links to on the right, and links
 * that go both ways in a band on top. Each side is ranked by page views and shows up to
 * `density` leaves.
 */
import { articleLinks } from "../core/links.ts";
import type {
  Article,
  Enrichments,
  GroupInfo,
  Lens,
  LensOptions,
  LinkDirection,
  MapEdge,
  MapGraph,
  MapNode,
  Title,
} from "../core/types.ts";

type SideId = "in" | "both" | "out";

/** The three sides: label, color slot (as in the preview), place and edge style. */
export const SIDES: { id: SideId; label: string; colorSlot: number; side: MapNode["side"] }[] = [
  { id: "both", label: "Both ways", colorSlot: 4, side: "top" },
  { id: "out", label: "Links out", colorSlot: 1, side: "right" },
  { id: "in", label: "Links here", colorSlot: 3, side: "left" },
];

/**
 * "+N more" on the incoming side shows at most this many: only the longest linking articles
 * have page views (sources/linksHere.ts, CANDIDATES), and a column of 2,000 can't be read.
 */
export const MAX_IN = 100;

export const links: Lens = {
  id: "links",
  label: "Links",
  needs: ["sections", "linksBack", "pageviews", "linksHere"],
  layout: "bipolar",
  defaults: {
    density: 6,
    showHousekeeping: false,
    includeOrigins: ["body", "hatnote"],
    folded: [],
    expanded: [],
  },
  explain: {
    steps: [
      "The article is loaded from Wikipedia, and every link in its text is collected: these are the links out, on the right.",
      "Wikipedia lists the articles that link here, up to 2,000: they are on the left. They show the context the article itself may never mention.",
      "Articles that are on both lists link each other. They are the closest relatives and sit in the band on top.",
      "On each side, the most read articles come first: the bar behind a label shows how often it was read in the last 30 days. The totals count every link in that direction.",
      "Tap a leaf to preview it. Tap ⊕ to make it the new center.",
    ],
    hidden:
      "Links out leave out infoboxes, footnotes and navigation boxes, and “See also” and similar chapters unless you turn them on; links to missing articles are left out too. Links here can come from anywhere in the other article, navigation boxes and lists included. When more than 2,000 articles link here, the 100 longest of them are ranked by views.",
    callouts: {
      center: {
        title: "The article",
        text: "The Wikipedia article you’re exploring. Tap it for its summary.",
      },
      group: {
        title: "A direction: {name}",
        text: "Left: articles that link here. Right: articles this one links to. On top: both ways. Tap − to fold a side.",
      },
      leafDirection: {
        title: "Link direction",
        text: "The symbol before each leaf shows which way its link goes:",
      },
      recenter: {
        title: "Recenter",
        text: "Tap ⊕ to make this article the new center of the map.",
      },
    },
  },
  build: buildLinks,
};

interface Candidate {
  target: Title;
  /** Reading order for links out, length order for links here: breaks ties in views. */
  order: number;
  views?: number;
  chapter?: string;
}

/** 1957 → "1,957", with "+" when the count is a lower bound. Pure: always the en format. */
export function formatTotal(n: number, atLeast = false): string {
  return `${n.toLocaleString("en")}${atLeast ? "+" : ""}`;
}

export function buildLinks(article: Article, data: Enrichments, options: LensOptions): MapGraph {
  const origins = new Set(options.includeOrigins);
  const folded = new Set(options.folded);
  const expanded = new Set(options.expanded);
  const views = data.pageviews ?? new Map<Title, number>();
  const here = data.linksHere ?? { titles: [], total: 0, capped: false };
  const hereSet = new Set(here.titles);

  const out = articleLinks(
    article,
    data.redirects,
    (link, section) =>
      origins.has(link.origin) &&
      !link.redLink &&
      (options.showHousekeeping || !section.housekeeping),
  );
  // Everything the article links to, from anywhere: such an article isn't "in only".
  const linkedAnywhere = new Set(
    articleLinks(article, data.redirects, () => true).map((l) => l.target),
  );

  // Without a cap, the list of incoming links is complete and decides. With a cap, the
  // links-back check covers the rest.
  const backOf = (target: Title): LinkDirection => {
    if (hereSet.has(target) || data.linksBack?.has(target)) return "both";
    if (!here.capped || data.linksChecked?.has(target)) return "out";
    return "pending";
  };

  const sides: Record<SideId, Candidate[]> = { both: [], out: [], in: [] };
  out.forEach((l, order) => {
    const c: Candidate = { target: l.target, order, chapter: l.chapter };
    const v = views.get(l.target);
    if (v !== undefined) c.views = v;
    sides[backOf(l.target) === "both" ? "both" : "out"].push(c);
  });
  here.titles.forEach((target, order) => {
    if (linkedAnywhere.has(target) || target === article.ref.title) return;
    const c: Candidate = { target, order };
    const v = views.get(target);
    if (v !== undefined) c.views = v;
    sides.in.push(c);
  });
  // Most read first; ties (and titles without views) keep their order.
  for (const list of Object.values(sides))
    list.sort((a, b) => (b.views ?? -1) - (a.views ?? -1) || a.order - b.order);

  const totals: Record<SideId, string> = {
    both: formatTotal(sides.both.length),
    out: formatTotal(sides.out.length),
    in: formatTotal(sides.in.length, here.capped),
  };

  const center: MapNode = {
    id: "center",
    kind: "center",
    label: article.displayTitle,
    target: article.ref.title,
  };
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const groups: GroupInfo[] = [];

  for (const side of SIDES) {
    const leaves = sides[side.id];
    const group: MapNode = {
      id: side.id,
      kind: "group",
      label: side.label,
      parent: "center",
      colorSlot: side.colorSlot,
      meta: { total: totals[side.id] },
    };
    if (side.side) group.side = side.side;
    groups.push({
      id: side.id,
      label: side.label,
      colorSlot: side.colorSlot,
      count: leaves.length,
    });
    nodes.push(group);
    edges.push({ from: "center", to: side.id, style: "trunk" });
    if (leaves.length === 0) {
      group.empty = true;
      group.count = 0;
      continue;
    }
    group.folded = folded.has(side.id);
    if (group.folded) {
      group.count = leaves.length;
      continue;
    }

    const all = side.id === "in" ? leaves.slice(0, MAX_IN) : leaves;
    const showAll = expanded.has(side.id);
    const shown = showAll ? all : all.slice(0, options.density);
    const maxViews = Math.max(1, ...all.map((l) => l.views ?? 0));
    for (const leaf of shown) {
      const id = `${side.id}/${leaf.target}`;
      const meta: Record<string, string | number> = { zone: side.label };
      if (leaf.chapter) meta.chapter = leaf.chapter;
      if (leaf.views !== undefined) meta.views = leaf.views;
      nodes.push({
        id,
        kind: "leaf",
        label: leaf.target,
        target: leaf.target,
        parent: side.id,
        colorSlot: side.colorSlot,
        direction: side.id === "in" ? "in" : side.id === "both" ? "both" : backOf(leaf.target),
        weight: (leaf.views ?? 0) / maxViews,
        meta,
      });
      edges.push({ from: side.id, to: id, style: side.id });
    }
    const hidden = all.length - shown.length;
    if (hidden > 0 || (showAll && all.length > options.density)) {
      const more: MapNode = {
        id: `${side.id}/+`,
        kind: "more",
        label: hidden > 0 ? `+${hidden} more` : "Show fewer",
        parent: side.id,
        colorSlot: side.colorSlot,
      };
      if (hidden > 0) more.count = hidden;
      nodes.push(more);
      edges.push({ from: side.id, to: more.id, style: "twig" });
    }
  }

  const graph: MapGraph = { lens: "links", center, nodes, edges, groups };
  if (out.length === 0 && sides.in.length === 0)
    graph.notes = ["No other article links here, and this one links to none."];
  return graph;
}
