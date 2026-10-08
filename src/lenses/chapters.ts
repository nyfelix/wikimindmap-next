/**
 * Chapters lens (US-01): the 2007 map. The lead and every chapter become branches, subchapters
 * thinner branches, and the links in their text become leaves (datamodel.md §4).
 */
import { uniqueLinks, type UniqueLink } from "../core/links.ts";
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
  Section,
  Title,
} from "../core/types.ts";

/** The lead has no heading; its branch gets this label. */
const INTRODUCTION: Record<string, string> = {
  en: "Introduction",
  de: "Einleitung",
  fr: "Introduction",
};

const PALETTE_SIZE = 6;

/** A chapter with its leaves, before it becomes nodes. */
interface Group {
  /** Numbered like a table of contents: "0" (lead), "2", "2.1". Used as node ID and in fold=. */
  id: string;
  label: string;
  housekeeping: boolean;
  leaves: UniqueLink[];
  children: Group[];
  /** Leaves in this group and all groups below it. */
  total: number;
}

export const chapters: Lens = {
  id: "chapters",
  label: "Chapters",
  needs: ["sections", "linksBack"],
  layout: "mindmapTree",
  defaults: {
    density: 4,
    showHousekeeping: false,
    includeOrigins: ["body", "hatnote"],
    folded: [],
    expanded: [],
  },
  explain: {
    steps: [
      "The article is loaded from Wikipedia and read chapter by chapter.",
      "The introduction and every chapter heading become a branch. Subchapters become thinner branches. Use − and + to fold them.",
      "Every link in the text of a chapter becomes a leaf. Links from infoboxes, footnotes and navigation boxes are left out.",
      "For each leaf, we check whether that article links back. The symbol shows the direction.",
      "Tap a leaf to preview it. Tap ⊕ to make it the new center.",
    ],
    hidden:
      "“See also”, “References” and similar chapters are hidden. Turn them on with See also at the bottom. Chapters without links are left out.",
    callouts: {
      center: {
        title: "The article",
        text: "The Wikipedia article you’re exploring. Tap it for its summary.",
      },
      group: {
        title: "A chapter: {name}",
        text: "Each chapter heading becomes a branch. Tap − to fold it.",
      },
      subgroup: {
        title: "A subchapter",
        text: "Deeper levels get thinner branches and fold on their own.",
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
  build: buildChapters,
};

export function buildChapters(article: Article, data: Enrichments, options: LensOptions): MapGraph {
  const self = article.ref.title;
  const origins = new Set(options.includeOrigins);
  const folded = new Set(options.folded);
  const expanded = new Set(options.expanded);

  const collect = (section: Section, id: string, label: string): Group | undefined => {
    if (section.housekeeping && !options.showHousekeeping) return undefined;
    const links = section.links.filter((l) => origins.has(l.origin));
    const leaves = uniqueLinks(links, data.redirects, self);
    const children = section.children
      .map((child, i) => collect(child, `${id}.${i + 1}`, child.title))
      .filter((g): g is Group => g !== undefined);
    const total = leaves.length + children.reduce((sum, c) => sum + c.total, 0);
    // A chapter without links would be an empty branch.
    if (total === 0) return undefined;
    return { id, label, housekeeping: section.housekeeping, leaves, children, total };
  };

  const top = [
    collect(article.lead, "0", INTRODUCTION[article.ref.lang] ?? "Introduction"),
    ...article.sections.map((s, i) => collect(s, String(i + 1), s.title)),
  ].filter((g): g is Group => g !== undefined);

  const center: MapNode = {
    id: "center",
    kind: "center",
    label: article.displayTitle,
    target: self,
  };
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const groups: GroupInfo[] = [];

  const directionOf = (target: Title): LinkDirection => {
    if (!data.linksBack || (data.linksChecked && !data.linksChecked.has(target))) return "pending";
    return data.linksBack.has(target) ? "both" : "out";
  };

  const emit = (
    group: Group,
    depth: number,
    parent: string,
    slot: number | undefined,
    path: string,
  ) => {
    const isFolded = folded.has(group.id);
    const node: MapNode = {
      id: group.id,
      kind: depth === 1 ? "group" : "subgroup",
      label: group.label,
      parent,
      folded: isFolded,
    };
    if (slot !== undefined) node.colorSlot = slot;
    if (isFolded) node.count = group.total;
    nodes.push(node);
    edges.push({ from: parent, to: group.id, style: depth === 1 ? "trunk" : "branch" });
    if (isFolded) return;

    const showAll = expanded.has(group.id);
    const shown = showAll ? group.leaves : group.leaves.slice(0, options.density);
    for (const leaf of shown) {
      const first = leaf.occurrences[0];
      const id = `${group.id}/${leaf.target}`;
      const node: MapNode = {
        id,
        kind: "leaf",
        label: leaf.target,
        target: leaf.target,
        parent: group.id,
        direction: directionOf(leaf.target),
        meta: { chapter: path },
      };
      if (slot !== undefined) node.colorSlot = slot;
      if (first?.redLink) node.redLink = true;
      nodes.push(node);
      edges.push({ from: group.id, to: id, style: "twig" });
    }
    const hidden = group.leaves.length - shown.length;
    if (hidden > 0 || (showAll && group.leaves.length > options.density)) {
      // "+N more" shows all links of this group; once expanded, the same node offers "Show fewer".
      const more: MapNode = {
        id: `${group.id}/+`,
        kind: "more",
        label: hidden > 0 ? `+${hidden} more` : "Show fewer",
        parent: group.id,
      };
      if (hidden > 0) more.count = hidden;
      if (slot !== undefined) more.colorSlot = slot;
      nodes.push(more);
      edges.push({ from: group.id, to: more.id, style: "twig" });
    }
    for (const child of group.children)
      emit(child, depth + 1, group.id, slot, `${path} › ${child.label}`);
  };

  let next = 0;
  for (const group of top) {
    // Housekeeping branches are muted; the others take the palette in turn.
    const slot = group.housekeeping ? undefined : (next++ % PALETTE_SIZE) + 1;
    emit(group, 1, "center", slot, group.label);
    const info: GroupInfo = { id: group.id, label: group.label, count: group.total };
    if (slot !== undefined) info.colorSlot = slot;
    groups.push(info);
  }

  const graph: MapGraph = { lens: "chapters", center, nodes, edges, groups };
  if (top.length === 0) graph.notes = ["This article has no links to other articles in its text."];
  return graph;
}
