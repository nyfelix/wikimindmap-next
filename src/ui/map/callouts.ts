/**
 * Where the map labels (US-18) go: next to their element, pushed away from the center, inside
 * the window and clear of each other. Pure; the component measures the elements.
 */
import type { CalloutTarget } from "../../core/types.ts";

// bottom: room for the map controls and the symbol key in the bottom right.
export const CALLOUT = { width: 220, height: 64, gap: 14, top: 86, bottom: 270 } as const;

export interface Anchor {
  key: CalloutTarget;
  /** Center of the element in window coordinates. */
  x: number;
  y: number;
}

export interface PlacedCallout {
  key: CalloutTarget;
  /** Top left of the callout box. */
  left: number;
  top: number;
  /** The element's point, where the leader line starts. */
  x: number;
  y: number;
}

export function placeCallouts(anchors: Anchor[], width: number, height: number): PlacedCallout[] {
  const cx = width / 2;
  const cy = height / 2;
  const placed: PlacedCallout[] = [];
  for (const a of anchors) {
    // Elements outside the window (panned or zoomed away) get no label.
    if (a.x < 0 || a.y < 0 || a.x > width || a.y > height) continue;
    const isCenter = a.key === "center";
    const sx = isCenter ? 0 : Math.sign(a.x - cx) || 1;
    const sy = isCenter ? 1 : Math.sign(a.y - cy) || -1;
    let left = isCenter ? a.x - CALLOUT.width / 2 : a.x + sx * 70 - (sx < 0 ? CALLOUT.width : 0);
    let top = isCenter ? a.y + 70 : a.y + sy * 60 - (sy < 0 ? CALLOUT.height : 0);
    left = clamp(left, CALLOUT.gap, width - CALLOUT.width - CALLOUT.gap);
    top = clamp(top, CALLOUT.top, height - CALLOUT.bottom);
    for (let tries = 0; tries < 6; tries++) {
      const hit = placed.find(
        (p) =>
          Math.abs(p.left - left) < CALLOUT.width + 10 &&
          Math.abs(p.top - top) < CALLOUT.height + 10,
      );
      if (!hit) break;
      const step = CALLOUT.height + 14;
      const max = height - CALLOUT.bottom;
      // Move on away from the center; at the window edge, go the other way instead.
      const away = hit.top + (sy > 0 ? 1 : -1) * step;
      top =
        away >= CALLOUT.top && away <= max
          ? away
          : clamp(hit.top - (sy > 0 ? 1 : -1) * step, CALLOUT.top, max);
    }
    placed.push({ key: a.key, left, top, x: a.x, y: a.y });
  }
  return placed;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
