import { describe, expect, it } from "vitest";
import {
  CALLOUT,
  labelPoint,
  placeCallouts,
  ringEdge,
  ringOf,
  type Rect,
} from "../../src/ui/map/callouts.ts";

const W = 1440;
const H = 900;
const at = (x: number, y: number, size = 20): Rect => ({
  x0: x - size / 2,
  y0: y - size / 2,
  x1: x + size / 2,
  y1: y + size / 2,
});
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const boxOf = (p: { left: number; top: number; height: number }): Rect => ({
  x0: p.left,
  y0: p.top,
  x1: p.left + CALLOUT.width,
  y1: p.top + p.height,
});

describe("placeCallouts", () => {
  it("never covers its own element", () => {
    const target = { x0: 620, y0: 420, x1: 820, y1: 474 };
    const [c] = placeCallouts([{ key: "center", target, height: 64 }], [], W, H);
    expect(overlap(boxOf(c!), target)).toBe(false);
  });

  it("goes away from the map's center", () => {
    const [right] = placeCallouts([{ key: "group", target: at(1100, 300), height: 64 }], [], W, H);
    const [left] = placeCallouts([{ key: "recenter", target: at(300, 600), height: 64 }], [], W, H);
    expect(right!.left).toBeGreaterThan(1100);
    expect(left!.left + CALLOUT.width).toBeLessThan(300);
  });

  it("keeps labels clear of each other, even for elements close together", () => {
    const placed = placeCallouts(
      [
        { key: "group", target: at(1000, 300), height: 64 },
        { key: "leafDirection", target: at(1080, 280), height: 110 },
        { key: "recenter", target: at(1120, 320), height: 64 },
      ],
      [],
      W,
      H,
    );
    expect(placed).toHaveLength(3);
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++)
        expect(overlap(boxOf(placed[i]!), boxOf(placed[j]!))).toBe(false);
  });

  it("avoids the map's text when there is room", () => {
    const leaves = Array.from({ length: 6 }, (_, i) => ({
      x0: 1040,
      y0: 260 + i * 30,
      x1: 1300,
      y1: 280 + i * 30,
    }));
    const [c] = placeCallouts([{ key: "group", target: at(1000, 330), height: 64 }], leaves, W, H);
    expect(leaves.some((l) => overlap(boxOf(c!), l))).toBe(false);
  });

  it("stays inside the window, clear of the panels", () => {
    const [c] = placeCallouts([{ key: "group", target: at(1430, 890), height: 64 }], [], W, H);
    expect(c!.left + CALLOUT.width).toBeLessThanOrEqual(W - CALLOUT.gap);
    expect(c!.top + c!.height).toBeLessThanOrEqual(H - CALLOUT.bottom);
    expect(c!.top).toBeGreaterThanOrEqual(CALLOUT.top);
  });

  it("leaves out elements outside the window", () => {
    expect(placeCallouts([{ key: "group", target: at(-50, 300), height: 64 }], [], W, H)).toEqual(
      [],
    );
  });

  it("starts the leader line at the label's point closest to the element", () => {
    expect(labelPoint({ key: "group", left: 100, top: 100, height: 60, x: 400, y: 120 })).toEqual({
      x: 320,
      y: 120,
    });
  });
});

describe("ring around a labelled element", () => {
  it("is a circle for small, square elements and a pill for wide ones", () => {
    expect(ringOf(18, 18)).toEqual({ shape: "circle", r: 14 });
    expect(ringOf(200, 54)).toEqual({ shape: "pill", halfWidth: 105, halfHeight: 32 });
  });

  it("ends the leader line on the ring, not on the element", () => {
    const circle = ringEdge({ shape: "circle", r: 10 }, 0, 0, 30, 40);
    expect(Math.hypot(circle.x, circle.y)).toBeCloseTo(10);
    expect(ringEdge({ shape: "pill", halfWidth: 100, halfHeight: 30 }, 0, 0, 0, 200)).toEqual({
      x: 0,
      y: 30,
    });
    expect(
      ringEdge({ shape: "pill", halfWidth: 100, halfHeight: 30 }, 0, 0, 400, 40).x,
    ).toBeCloseTo(100);
  });
});
