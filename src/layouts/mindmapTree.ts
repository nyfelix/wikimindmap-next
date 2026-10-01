/**
 * mindmapTree (US-01): the two-sided mind map. First-level groups are split between the right
 * and the left side, clockwise from the top right, so both sides get a similar number of rows.
 *
 * Rows come from d3-hierarchy's cluster(): every leaf (and folded group) gets its own row and a
 * parent sits in the middle of its children. tree() would compact subtrees so that leaves at
 * different depths share a row, and their labels would overlap. Columns are as wide as the
 * longest group label at that depth, so labels never reach into the column before them.
 */
import { cluster, hierarchy, type HierarchyNode } from "d3-hierarchy";
import type {
  Layout,
  LayoutOptions,
  MapEdge,
  MapGraph,
  MapNode,
  PositionedEdge,
  PositionedMap,
  PositionedNode,
} from "../core/types.ts";
import {
  CAPSULE_HALF,
  CENTER,
  COUNT_DX,
  estimateText,
  FOLD_R,
  GLYPH_R,
  GROUP_LABEL,
  LABEL_GAP,
  MAX_CHARS,
  RECENTER_GAP,
  RECENTER_R,
  shorten,
  textBox,
  type TextStyle,
} from "./geometry.ts";

/** Distance between two leaf rows; rows of different branches get a little more air. */
export const ROW = 30;
const BRANCH_SEPARATION = 1.5;
/** Minimum horizontal distance from a branch point to its children. */
const MIN_COLUMN = 130;

const WIDTH = { trunk: [14, 5], branch: [6, 2.5], twig: [1.8, 1.8] } as const;

type Side = 1 | -1;

export const mindmapTree: Layout = (
  graph: MapGraph,
  _viewport: { width: number; height: number },
  options: LayoutOptions = {},
): PositionedMap => {
  const measure = options.measure ?? estimateText;
  const children = new Map<string, MapNode[]>();
  for (const node of graph.nodes) {
    const parent = node.parent ?? "center";
    const list = children.get(parent);
    if (list) list.push(node);
    else children.set(parent, [node]);
  }

  const rowsMemo = new Map<string, number>();
  const rows = (node: MapNode): number => {
    let n = rowsMemo.get(node.id);
    if (n === undefined) {
      const kids = children.get(node.id) ?? [];
      n = kids.length === 0 ? 1 : kids.reduce((sum, k) => sum + rows(k), 0);
      rowsMemo.set(node.id, n);
    }
    return n;
  };

  // Clockwise from the top right: the first groups fill the right side top to bottom, the rest
  // continue on the left from the bottom up.
  const top = children.get("center") ?? [];
  const total = top.reduce((sum, n) => sum + rows(n), 0);
  const right: MapNode[] = [];
  const left: MapNode[] = [];
  let acc = 0;
  for (const node of top) {
    if (left.length === 0 && (right.length === 0 || acc + rows(node) / 2 <= total / 2)) {
      right.push(node);
      acc += rows(node);
    } else {
      left.push(node);
    }
  }
  left.reverse();

  const centerText = shorten(graph.center.label, MAX_CHARS.group);
  const centerTextWidth = measure(centerText, "center");
  const centerWidth = centerTextWidth + 2 * CENTER.padding;
  const positioned: PositionedNode[] = [
    {
      node: graph.center,
      x: 0,
      y: 0,
      labelSide: "center",
      side: 1,
      depth: 0,
      text: centerText,
      textWidth: centerTextWidth,
    },
  ];

  const styleOf = (node: MapNode, depth: number): TextStyle => {
    if (node.kind === "group" || node.kind === "subgroup")
      return depth === 1 ? "group" : "subgroup";
    if (node.kind === "more") return "count";
    return options.bold?.(node) ? "leafBold" : "leaf";
  };

  const placeSide = (list: MapNode[], side: Side) => {
    if (list.length === 0) return;
    const root = hierarchy<MapNode>({ id: `root${side}`, kind: "center", label: "" }, (n) =>
      n.id === `root${side}` ? list : children.get(n.id),
    );
    const isRow = (n: HierarchyNode<MapNode>) => n.data.kind === "leaf" || n.data.kind === "more";
    cluster<MapNode>()
      .nodeSize([ROW, 1])
      .separation((a, b) =>
        a.parent === b.parent && isRow(a) && isRow(b) ? 1 : BRANCH_SEPARATION,
      )(root);

    // Text first: the widest group label per depth decides the column widths.
    const text = new Map<string, { text: string; width: number }>();
    const widest: number[] = [];
    for (const n of root.descendants()) {
      if (n.depth === 0) continue;
      const node = n.data;
      const style = styleOf(node, n.depth);
      const isGroup = node.kind === "group" || node.kind === "subgroup";
      const label = shorten(node.label, isGroup ? MAX_CHARS.group : MAX_CHARS.leaf);
      const width = measure(label, style);
      text.set(node.id, { text: label, width });
      if (isGroup) widest[n.depth] = Math.max(widest[n.depth] ?? 0, width);
    }
    // column[0] is the edge of the center pill.
    const column: number[] = [centerWidth / 2];
    for (let d = 1; d <= root.height; d++) {
      const label = (widest[d] ?? 0) + GROUP_LABEL.dx + 24;
      column[d] = (column[d - 1] ?? 0) + Math.max(d === 1 ? 110 : MIN_COLUMN, label);
    }

    const mid = (root.x ?? 0) as number;
    for (const n of root.descendants()) {
      if (n.depth === 0) continue;
      const node = n.data;
      const t = text.get(node.id) ?? { text: node.label, width: 0 };
      const isGroup = node.kind === "group" || node.kind === "subgroup";
      positioned.push({
        node,
        x: side * (column[n.depth] ?? 0),
        y: (n.x ?? 0) - mid,
        // Group labels run toward the center, above the branch point; the rest away from it.
        labelSide: (isGroup ? -side : side) > 0 ? "right" : "left",
        side,
        depth: n.depth,
        text: t.text,
        textWidth: t.width,
      });
    }
  };
  placeSide(right, 1);
  placeSide(left, -1);

  const at = new Map(positioned.map((p) => [p.node.id, p]));
  const edges = graph.edges
    .map((edge) => {
      const from = at.get(edge.from);
      const to = at.get(edge.to);
      return from && to ? positionEdge(edge, from, to, centerWidth) : undefined;
    })
    .filter((e): e is PositionedEdge => e !== undefined);

  return { viewBox: boundsOf(positioned, centerWidth), nodes: positioned, edges };
};

function positionEdge(
  edge: MapEdge,
  from: PositionedNode,
  to: PositionedNode,
  centerWidth: number,
): PositionedEdge {
  const side = to.side;
  const x0 = from.node.kind === "center" ? side * (centerWidth / 2 - 18) : from.x + side * FOLD_R;
  const y0 = from.y;
  let x1 = to.x;
  if (to.node.kind === "leaf") x1 -= side * (glyphHalf(to.node) + 1);
  if (to.node.kind === "more") x1 -= side * 2;
  const [w0, w1] =
    edge.style === "trunk" ? WIDTH.trunk : edge.style === "branch" ? WIDTH.branch : WIDTH.twig;
  const path = edge.style === "twig" ? curve(x0, y0, x1, to.y) : taper(x0, y0, x1, to.y, w0, w1);
  return { edge, path, width: w0 };
}

/** A filled shape that narrows from w0 to w1: the tapered branch of the Option 3 look. */
function taper(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number): string {
  const mx = (x0 + x1) / 2;
  const a = w0 / 2;
  const b = w1 / 2;
  return (
    `M${f(x0)} ${f(y0 - a)}C${f(mx)} ${f(y0 - a)} ${f(mx)} ${f(y1 - b)} ${f(x1)} ${f(y1 - b)}` +
    `L${f(x1)} ${f(y1 + b)}C${f(mx)} ${f(y1 + b)} ${f(mx)} ${f(y0 + a)} ${f(x0)} ${f(y0 + a)}Z`
  );
}

function curve(x0: number, y0: number, x1: number, y1: number): string {
  const mx = (x0 + x1) / 2;
  return `M${f(x0)} ${f(y0)}C${f(mx)} ${f(y0)} ${f(mx)} ${f(y1)} ${f(x1)} ${f(y1)}`;
}

const f = (n: number) => String(Math.round(n * 10) / 10);

/** The text next to a folded group. */
export function foldedLabel(node: MapNode): string {
  const n = node.count ?? 0;
  return `+${n} ${n === 1 ? "link" : "links"}`;
}

export function glyphHalf(node: MapNode): number {
  return node.direction === "both" ? CAPSULE_HALF : GLYPH_R;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const span = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)] as const;

/** Where the text and symbols of a node are drawn: for the viewBox and the overlap test. */
export function nodeBoxes(p: PositionedNode): Box[] {
  const { node, x, y, side } = p;
  const boxes: Box[] = [];
  const add = (a: number, b: number, top: number, bottom: number) => {
    const [x0, x1] = span(a, b);
    boxes.push({ x0, y0: top, x1, y1: bottom });
  };
  switch (node.kind) {
    case "center": {
      const half = p.textWidth / 2 + CENTER.padding;
      add(-half, half, y - CENTER.height / 2, y + CENTER.height / 2);
      break;
    }
    case "group":
    case "subgroup": {
      const style = p.depth === 1 ? "group" : "subgroup";
      const box = textBox(style);
      const end = x - side * GROUP_LABEL.dx;
      add(
        end,
        end - side * p.textWidth,
        y - GROUP_LABEL.dy - box.above,
        y - GROUP_LABEL.dy + box.below,
      );
      add(x - FOLD_R, x + FOLD_R, y - FOLD_R, y + FOLD_R);
      if (node.folded) {
        const count = textBox("count");
        const start = x + side * COUNT_DX;
        const width = estimateText(foldedLabel(node), "count");
        add(start, start + side * width, y - count.above + 4.5, y + count.below + 4.5);
      }
      break;
    }
    case "leaf": {
      const box = textBox("leaf");
      const half = glyphHalf(node);
      let end = x + side * (half + LABEL_GAP + p.textWidth);
      if (!node.redLink) end += side * (RECENTER_GAP + RECENTER_R);
      add(x - side * half, end, y + 5 - box.above, y + 5 + box.below);
      break;
    }
    case "more": {
      const box = textBox("count");
      add(x + side * 2, x + side * (2 + p.textWidth), y + 4.5 - box.above, y + 4.5 + box.below);
      break;
    }
  }
  return boxes;
}

function boundsOf(nodes: PositionedNode[], centerWidth: number): PositionedMap["viewBox"] {
  let x0 = -centerWidth / 2;
  let x1 = centerWidth / 2;
  let y0 = -CENTER.height / 2;
  let y1 = CENTER.height / 2;
  for (const p of nodes) {
    for (const b of nodeBoxes(p)) {
      x0 = Math.min(x0, b.x0);
      x1 = Math.max(x1, b.x1);
      y0 = Math.min(y0, b.y0);
      y1 = Math.max(y1, b.y1);
    }
  }
  const pad = 24;
  return { x: x0 - pad, y: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad };
}
