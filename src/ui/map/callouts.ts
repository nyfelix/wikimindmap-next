/**
 * Where the map labels (US-18) go. Each label tries positions all around its element and takes
 * the one that covers least: other labels most of all, then the element itself, then the map's
 * text and symbols. Prefers positions away from the map's center, and stays inside the window.
 * Pure; the component measures the elements.
 */
import type { CalloutTarget } from "../../core/types.ts";

/** Label width, the window margin, and the room the panels take at the top and bottom. */
export const CALLOUT = { width: 220, gap: 14, top: 86, bottom: 96 } as const;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Anchor {
  key: CalloutTarget;
  /** The element, in window coordinates. */
  target: Rect;
  /** The label's height (it depends on its text). */
  height: number;
}

export interface PlacedCallout {
  key: CalloutTarget;
  /** Top left of the label. */
  left: number;
  top: number;
  height: number;
  /** Center of the element, where the ring is. */
  x: number;
  y: number;
}

const DISTANCES = [18, 44, 80, 130];
const DIRECTIONS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const area = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * @param obstacles the map's text, symbols and buttons: covering them is allowed, but avoided.
 */
export function placeCallouts(
  anchors: Anchor[],
  obstacles: Rect[],
  width: number,
  height: number,
): PlacedCallout[] {
  const midX = width / 2;
  const midY = height / 2;
  const placed: (PlacedCallout & { box: Rect })[] = [];

  for (const a of anchors) {
    const t = a.target;
    const x = (t.x0 + t.x1) / 2;
    const y = (t.y0 + t.y1) / 2;
    // Elements outside the window (panned or zoomed away) get no label.
    if (x < 0 || y < 0 || x > width || y > height) continue;
    const w = CALLOUT.width;
    const h = a.height;
    let best: { box: Rect; score: number } | undefined;

    for (const [sx, sy] of DIRECTIONS) {
      for (const d of DISTANCES) {
        const left = clamp(
          sx > 0 ? t.x1 + d : sx < 0 ? t.x0 - d - w : x - w / 2,
          CALLOUT.gap,
          width - w - CALLOUT.gap,
        );
        const top = clamp(
          sy > 0 ? t.y1 + d : sy < 0 ? t.y0 - d - h : y - h / 2,
          CALLOUT.top,
          height - CALLOUT.bottom - h,
        );
        const box = { x0: left, y0: top, x1: left + w, y1: top + h };
        let score = 0;
        for (const p of placed) score += 50 * area(box, inflate(p.box, 8));
        // Never cover the element the label explains.
        score += 1000 * area(box, inflate(t, 6));
        for (const o of obstacles) score += area(box, o);
        // Small preferences: close to the element, and away from the map's center.
        score += d * 4;
        const outward =
          (sx === 0 || sx === Math.sign(x - midX)) && (sy === 0 || sy === Math.sign(y - midY));
        if (!outward) score += 600;
        if (!best || score < best.score) best = { box, score };
      }
    }
    if (best)
      placed.push({
        key: a.key,
        left: best.box.x0,
        top: best.box.y0,
        height: h,
        x,
        y,
        box: best.box,
      });
  }
  return placed.map(({ box: _box, ...p }) => p);
}

function inflate(r: Rect, by: number): Rect {
  return { x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by };
}

/** Where the leader line leaves the label: the point of the label closest to the element. */
export function labelPoint(c: PlacedCallout): { x: number; y: number } {
  return {
    x: clamp(c.x, c.left, c.left + CALLOUT.width),
    y: clamp(c.y, c.top, c.top + c.height),
  };
}

/** The ring around a labelled element: a circle, or a rounded outline for wide ones (the center). */
export type Ring =
  { shape: "circle"; r: number } | { shape: "pill"; halfWidth: number; halfHeight: number };

const RING_GAP = 5;

export function ringOf(width: number, height: number): Ring {
  if (width > height * 1.6) {
    return { shape: "pill", halfWidth: width / 2 + RING_GAP, halfHeight: height / 2 + RING_GAP };
  }
  return { shape: "circle", r: Math.max(width, height) / 2 + RING_GAP };
}

/** Where the leader line from (toX, toY) meets the ring around (x, y). */
export function ringEdge(ring: Ring, x: number, y: number, toX: number, toY: number) {
  const dx = toX - x;
  const dy = toY - y;
  const length = Math.hypot(dx, dy) || 1;
  if (ring.shape === "circle")
    return { x: x + (dx / length) * ring.r, y: y + (dy / length) * ring.r };
  // The outline's bounding box is close enough for a pill: the line meets its nearest side.
  const scale = Math.min(
    dx === 0 ? Infinity : ring.halfWidth / Math.abs(dx),
    dy === 0 ? Infinity : ring.halfHeight / Math.abs(dy),
  );
  return { x: x + dx * scale, y: y + dy * scale };
}
