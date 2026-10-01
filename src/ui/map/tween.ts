/**
 * Moves the map smoothly from one layout to the next (styleguide.md §7): nodes present in both
 * glide to their new place, new ones fade in, old ones fade out. Layout-agnostic: paths are
 * interpolated number by number when they have the same shape.
 */
import type { PositionedEdge, PositionedMap, PositionedNode } from "../../core/types.ts";

export interface FrameNode {
  p: PositionedNode;
  opacity: number;
  /** Fading out: not interactive any more. */
  leaving: boolean;
}

export interface FrameEdge {
  e: PositionedEdge;
  key: string;
  opacity: number;
  leaving: boolean;
}

export interface Frame {
  nodes: FrameNode[];
  edges: FrameEdge[];
}

export const edgeKey = (e: PositionedEdge) => `${e.edge.from}>${e.edge.to}`;

export function staticFrame(map: PositionedMap): Frame {
  return {
    nodes: map.nodes.map((p) => ({ p, opacity: 1, leaving: false })),
    edges: map.edges.map((e) => ({ e, key: edgeKey(e), opacity: 1, leaving: false })),
  };
}

const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/** Interpolates two SVG paths of the same shape; otherwise jumps to `to`. */
export function lerpPath(from: string, to: string, t: number): string {
  const a = from.match(NUMBER);
  const b = to.match(NUMBER);
  if (!a || !b || a.length !== b.length || from.replace(NUMBER, "#") !== to.replace(NUMBER, "#")) {
    return t < 1 ? from : to;
  }
  let i = 0;
  return to.replace(NUMBER, () => {
    const value = Number(a[i]) + (Number(b[i]) - Number(a[i])) * t;
    i++;
    return String(Math.round(value * 10) / 10);
  });
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Where an entering node comes from: the node with the same ID, or — after recentering — the
 * old node that stands for the same article (the clicked leaf becomes the new center).
 */
function matchFrom(
  ids: Map<string, PositionedNode>,
  byTarget: Map<string, PositionedNode>,
  p: PositionedNode,
) {
  const sameArticle = p.node.target ? byTarget.get(p.node.target) : undefined;
  // Every center has the ID "center": after recentering, the new center is the clicked leaf.
  if (p.node.kind === "center") return sameArticle ?? ids.get(p.node.id);
  return ids.get(p.node.id) ?? sameArticle;
}

export function frameAt(prev: PositionedMap, next: PositionedMap, t: number): Frame {
  const k = easeInOut(Math.min(1, Math.max(0, t)));
  const ids = new Map(prev.nodes.map((p) => [p.node.id, p]));
  const byTarget = new Map<string, PositionedNode>();
  for (const p of prev.nodes)
    if (p.node.target && !byTarget.has(p.node.target)) byTarget.set(p.node.target, p);

  const nodes: FrameNode[] = [];
  const kept = new Set<string>();
  for (const p of next.nodes) {
    const from = matchFrom(ids, byTarget, p);
    if (from) {
      kept.add(from.node.id);
      nodes.push({
        p: { ...p, x: from.x + (p.x - from.x) * k, y: from.y + (p.y - from.y) * k },
        opacity: 1,
        leaving: false,
      });
    } else {
      nodes.push({ p, opacity: k, leaving: false });
    }
  }
  // Old nodes nothing moved on from fade out (also the old center after recentering).
  for (const p of prev.nodes) {
    if (!kept.has(p.node.id)) nodes.unshift({ p, opacity: 1 - k, leaving: true });
  }

  const prevEdges = new Map(prev.edges.map((e) => [edgeKey(e), e]));
  const nextKeys = new Set(next.edges.map(edgeKey));
  const edges: FrameEdge[] = [];
  for (const e of prev.edges) {
    const key = edgeKey(e);
    if (!nextKeys.has(key)) edges.push({ e, key: `${key}~`, opacity: 1 - k, leaving: true });
  }
  for (const e of next.edges) {
    const key = edgeKey(e);
    const old = prevEdges.get(key);
    edges.push(
      old
        ? { e: { ...e, path: lerpPath(old.path, e.path, k) }, key, opacity: 1, leaving: false }
        : { e, key, opacity: k, leaving: false },
    );
  }
  return { nodes, edges };
}
