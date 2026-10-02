/**
 * Kinds lens (US-13): the article's links sorted by what they are, according to Wikidata, into
 * six fixed branches in fixed places (concepts/lens-kinds.html). Leaves are ranked by page views.
 */
import { articleLinks } from "../core/links.ts";
import type {
  Article,
  Enrichments,
  GroupInfo,
  Kind,
  Lens,
  LensOptions,
  LinkDirection,
  MapEdge,
  MapGraph,
  MapNode,
  Title,
} from "../core/types.ts";

/** The six branches: label, color slot (as in the preview) and fixed place. */
export const KINDS: { id: Kind; label: string; colorSlot: number; side: "left" | "right" }[] = [
  // Right column, top to bottom.
  { id: "concepts", label: "Concepts", colorSlot: 1, side: "right" },
  { id: "works", label: "Works", colorSlot: 4, side: "right" },
  { id: "events", label: "Events", colorSlot: 6, side: "right" },
  // Left column, top to bottom.
  { id: "people", label: "People", colorSlot: 3, side: "left" },
  { id: "orgs", label: "Organizations", colorSlot: 2, side: "left" },
  { id: "places", label: "Places", colorSlot: 5, side: "left" },
];

export const kinds: Lens = {
  id: "kinds",
  label: "Kinds",
  needs: ["sections", "linksBack", "pageviews", "kinds"],
  layout: "mindmapTree",
  defaults: {
    density: 5,
    showHousekeeping: false,
    includeOrigins: ["body", "hatnote"],
    folded: [],
    expanded: [],
  },
  explain: {
    steps: [
      "The article is loaded from Wikipedia, and every link in its text is collected.",
      "For each linked article, Wikidata says what it is (“instance of”). Its parent classes lead to one of six kinds: people, organizations, works, concepts, events and places.",
      "The six kinds are fixed branches in fixed places, so every map reads the same way. An empty branch shows that nothing of that kind is linked.",
      "Within a branch, the most read articles come first: the bar behind a label shows how often it was read in the last 30 days.",
      "Tap a leaf to preview it. Tap ⊕ to make it the new center.",
    ],
    hidden:
      "Links from infoboxes, footnotes and navigation boxes are left out, and so are “See also” and similar chapters unless you turn them on. Links to missing articles have no Wikidata entry and are left out too. Anything Wikidata doesn’t place goes to Concepts.",
    callouts: {
      center: {
        title: "The article",
        text: "The Wikipedia article you’re exploring. Tap it for its summary.",
      },
      group: {
        title: "A kind: {name}",
        text: "Every map has the same six branches, always in the same place. Tap − to fold one.",
      },
      leafDirection: {
        title: "Link direction",
        text: "→ this article links there. ⇄ that article links back too.",
      },
      recenter: {
        title: "Recenter",
        text: "Tap ⊕ to make this article the new center of the map.",
      },
    },
  },
  build: buildKinds,
};

export function buildKinds(article: Article, data: Enrichments, options: LensOptions): MapGraph {
  const origins = new Set(options.includeOrigins);
  const folded = new Set(options.folded);
  const expanded = new Set(options.expanded);
  const views = data.pageviews ?? new Map<Title, number>();

  const links = articleLinks(
    article,
    data.redirects,
    (link, section) =>
      origins.has(link.origin) &&
      !link.redLink &&
      (options.showHousekeeping || !section.housekeeping),
  );
  const maxViews = Math.max(1, ...links.map((l) => views.get(l.target) ?? 0));

  const directionOf = (target: Title): LinkDirection => {
    if (!data.linksBack || (data.linksChecked && !data.linksChecked.has(target))) return "pending";
    return data.linksBack.has(target) ? "both" : "out";
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

  for (const kind of KINDS) {
    // Most read first; ties keep reading order.
    const leaves = links
      .filter((l) => (data.kinds?.get(l.target)?.kind ?? "concepts") === kind.id)
      .map((l, order) => ({ ...l, order, views: views.get(l.target) ?? 0 }))
      .sort((a, b) => b.views - a.views || a.order - b.order);

    const group: MapNode = {
      id: kind.id,
      kind: "group",
      label: kind.label,
      parent: "center",
      colorSlot: kind.colorSlot,
      side: kind.side,
    };
    groups.push({
      id: kind.id,
      label: kind.label,
      colorSlot: kind.colorSlot,
      count: leaves.length,
    });
    edges.push({ from: "center", to: kind.id, style: "trunk" });
    nodes.push(group);
    if (leaves.length === 0) {
      group.empty = true;
      group.count = 0;
      continue;
    }
    group.folded = folded.has(kind.id);
    if (group.folded) {
      group.count = leaves.length;
      continue;
    }

    const showAll = expanded.has(kind.id);
    const shown = showAll ? leaves : leaves.slice(0, options.density);
    for (const leaf of shown) {
      const info = data.kinds?.get(leaf.target);
      const id = `${kind.id}/${leaf.target}`;
      const meta: Record<string, string | number> = { kind: kind.label, views: leaf.views };
      if (leaf.chapter) meta.chapter = leaf.chapter;
      if (info?.instanceOf.length) meta.instanceOf = info.instanceOf.join(", ");
      nodes.push({
        id,
        kind: "leaf",
        label: leaf.target,
        target: leaf.target,
        parent: kind.id,
        colorSlot: kind.colorSlot,
        direction: directionOf(leaf.target),
        weight: leaf.views / maxViews,
        meta,
      });
      edges.push({ from: kind.id, to: id, style: "twig" });
    }
    const hidden = leaves.length - shown.length;
    if (hidden > 0 || (showAll && leaves.length > options.density)) {
      const more: MapNode = {
        id: `${kind.id}/+`,
        kind: "more",
        label: hidden > 0 ? `+${hidden} more` : "Show fewer",
        parent: kind.id,
        colorSlot: kind.colorSlot,
      };
      if (hidden > 0) more.count = hidden;
      nodes.push(more);
      edges.push({ from: kind.id, to: more.id, style: "twig" });
    }
  }

  const graph: MapGraph = { lens: "kinds", center, nodes, edges, groups };
  if (links.length === 0)
    graph.notes = ["This article has no links to other articles in its text."];
  else {
    const none = groups.filter((g) => g.count === 0).map((g) => `${g.label}: none linked`);
    if (none.length) graph.notes = none;
  }
  return graph;
}
