/**
 * bipolar (US-15): the map split by link direction (concepts/lens-links.html). Groups with the
 * side hint "left" and "right" become columns beside the center, with one arrow per leaf
 * (toward the center for links here, away from it for links out). The "top" group is a band of
 * pills above the center, wrapped into rows, joined to the center by one double arrow.
 *
 * Each group has a zone label (tracked capitals) with its fold toggle above its leaves. The
 * columns start below the band, so a long column grows downward instead of into it.
 */
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
  boundsOf,
  CENTER,
  COUNT_DX,
  estimateText,
  foldedLabel,
  FOLD_R,
  GLYPH_R,
  glyphHalf,
  MAX_CHARS,
  PILL,
  pillWidth,
  shorten,
  ZONE,
  type TextStyle,
} from "./geometry.ts";

/** Distance between two leaf rows in a column. */
export const ROW = 32;
/** From the edge of the center pill to the column of symbols. */
const COLUMN_GAP = 170;
/** Length of the double arrow between the center and the band. */
const ARROW = 110;
/** Rows of pills, and the space between two pills in a row. */
const BAND_ROW = 44;
const PILL_GAP = 10;
/** From a zone label to the first leaf below it. */
const ZONE_GAP = 34;
/** Space kept between the band and the zone labels of the columns. */
const BAND_CLEARANCE = 30;

type Side = 1 | -1;

export const bipolar: Layout = (
  graph: MapGraph,
  _viewport: { width: number; height: number },
  options: LayoutOptions = {},
): PositionedMap => {
  const measure = options.measure ?? estimateText;
  const row = options.row ?? ROW;
  const children = new Map<string, MapNode[]>();
  for (const node of graph.nodes) {
    const parent = node.parent ?? "center";
    const list = children.get(parent);
    if (list) list.push(node);
    else children.set(parent, [node]);
  }
  const kids = (id: string) => children.get(id) ?? [];

  const centerText = shorten(graph.center.label, MAX_CHARS.group);
  const centerTextWidth = measure(centerText, "center");
  const centerWidth = centerTextWidth + 2 * CENTER.padding;
  const columnX = centerWidth / 2 + COLUMN_GAP;
  const centerTop = -CENTER.height / 2;
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

  const leafStyle = (node: MapNode): TextStyle =>
    node.kind === "more" ? "count" : options.bold?.(node) ? "leafBold" : "leaf";
  const leafText = (node: MapNode) => {
    const text = shorten(node.label, MAX_CHARS.leaf);
    return { text, width: measure(text, leafStyle(node)) };
  };
  const zone = (group: MapNode, x: number, y: number, side: Side): PositionedNode => {
    const total = group.meta?.total;
    const text = (total !== undefined ? `${group.label} · ${total}` : group.label).toUpperCase();
    return {
      node: group,
      x,
      y,
      labelSide: "above",
      side,
      depth: 1,
      text,
      textWidth: measure(text, "zone"),
    };
  };
  const zoneWidth = (p: PositionedNode) =>
    2 * FOLD_R +
    ZONE.dx +
    p.textWidth +
    (p.node.folded || p.node.empty ? COUNT_DX + estimateText(foldedLabel(p.node), "count") : 0);

  const top = kids("center");
  const band = top.find((n) => n.side === "top");

  // The band: pills wrapped into rows, centered, the last row just above the arrow.
  let bandBottom: number | undefined;
  if (band) {
    const items = kids(band.id).map((node) => {
      const t = leafText(node);
      const half = glyphHalf(node);
      const width = node.kind === "leaf" ? pillWidth(t.width, half) : t.width + 8;
      return { node, text: t.text, textWidth: t.width, half, width };
    });
    const maxWidth = Math.max(560, 2 * columnX + 160);
    const rows: (typeof items)[] = [];
    let used = 0;
    for (const item of items) {
      const last = rows[rows.length - 1];
      if (!last || (used + item.width > maxWidth && last.length > 0)) {
        rows.push([item]);
        used = item.width + PILL_GAP;
      } else {
        last.push(item);
        used += item.width + PILL_GAP;
      }
    }
    const lastY = centerTop - ARROW - PILL.height / 2;
    rows.forEach((items, i) => {
      const y = lastY - (rows.length - 1 - i) * BAND_ROW;
      const width = items.reduce((sum, it) => sum + it.width, 0) + (items.length - 1) * PILL_GAP;
      let left = -width / 2;
      for (const it of items) {
        positioned.push({
          node: it.node,
          x: it.node.kind === "leaf" ? left + PILL.pad + it.half : left,
          y,
          labelSide: "right",
          side: 1,
          depth: 2,
          text: it.text,
          textWidth: it.textWidth,
          ...(it.node.kind === "leaf" ? { pill: true } : {}),
        });
        left += it.width + PILL_GAP;
      }
    });
    const firstY = lastY - (rows.length - 1) * BAND_ROW;
    const zoneY = rows.length ? firstY - PILL.height / 2 - 22 : centerTop - ARROW;
    const head = zone(band, 0, zoneY, 1);
    head.x = -zoneWidth(head) / 2 + FOLD_R;
    positioned.push(head);
    bandBottom = rows.length ? lastY + PILL.height / 2 : zoneY + FOLD_R;
  }

  // The columns: a zone label, then one row per leaf.
  const minZoneY = bandBottom === undefined ? -Infinity : centerTop - ARROW + BAND_CLEARANCE;
  for (const group of top) {
    if (group === band) continue;
    const side: Side = group.side === "left" ? -1 : 1;
    const list = kids(group.id);
    const height = (list.length - 1) * row;
    const firstY = list.length
      ? Math.max(-height / 2 + 12, minZoneY + ZONE_GAP)
      : Math.max(0, minZoneY + ZONE_GAP);
    positioned.push(zone(group, side * columnX, list.length ? firstY - ZONE_GAP : 0, side));
    list.forEach((node, i) => {
      const t = leafText(node);
      positioned.push({
        node,
        x: side * (node.kind === "more" ? columnX - GLYPH_R : columnX),
        y: firstY + i * row,
        labelSide: side > 0 ? "right" : "left",
        side,
        depth: 2,
        text: t.text,
        textWidth: t.width,
      });
    });
  }

  const at = new Map(positioned.map((p) => [p.node.id, p]));
  const edges: PositionedEdge[] = [];
  for (const edge of graph.edges) {
    const from = at.get(edge.from);
    const to = at.get(edge.to);
    if (!from || !to) continue;
    const e = positionEdge(edge, from, to, centerWidth, bandBottom);
    if (e) edges.push(e);
  }

  return { viewBox: boundsOf(positioned, centerWidth), nodes: positioned, edges };
};

/**
 * The band gets one double arrow from the center; column leaves get an arrow each. Empty
 * columns get a dotted line to their zone label. Pills, folded columns and "more" get none.
 */
function positionEdge(
  edge: MapEdge,
  from: PositionedNode,
  to: PositionedNode,
  centerWidth: number,
  bandBottom: number | undefined,
): PositionedEdge | undefined {
  if (from.node.kind === "center") {
    if (to.node.side === "top" && bandBottom !== undefined) {
      const path = `M0 ${f(-CENTER.height / 2 - 6)}L0 ${f(bandBottom + 8)}`;
      return { edge: { ...edge, style: "both" }, path, width: 3 };
    }
    if (!to.node.empty) return undefined;
    const x0 = to.side * (centerWidth / 2 + 6);
    return { edge, path: curve(x0, 0, to.x, to.y), width: 3 };
  }
  if (to.node.kind !== "leaf" || to.pill) return undefined;
  const side = to.side;
  // Arrows meet the center fanned out a little, so their heads don't pile up.
  const cx = side * (centerWidth / 2 + 8);
  const cy = Math.max(-14, Math.min(14, to.y * 0.15));
  const ax = to.x - side * (glyphHalf(to.node) + 4);
  const path = edge.style === "in" ? curve(ax, to.y, cx, cy) : curve(cx, cy, ax, to.y);
  return { edge, path, width: 1.8 };
}

function curve(x0: number, y0: number, x1: number, y1: number): string {
  const mx = (x0 + x1) / 2;
  return `M${f(x0)} ${f(y0)}C${f(mx)} ${f(y0)} ${f(mx)} ${f(y1)} ${f(x1)} ${f(y1)}`;
}

const f = (n: number) => String(Math.round(n * 10) / 10);
