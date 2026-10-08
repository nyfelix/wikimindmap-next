import { describe, expect, it } from "vitest";
import { CALLOUT, placeCallouts } from "../../src/ui/map/callouts.ts";

describe("placeCallouts", () => {
  const W = 1440;
  const H = 900;

  it("puts the center label below the center", () => {
    const [c] = placeCallouts([{ key: "center", x: 720, y: 450 }], W, H);
    expect(c!.top).toBeGreaterThan(450);
    expect(c!.left + CALLOUT.width / 2).toBeCloseTo(720);
  });

  it("pushes labels away from the center", () => {
    const [right] = placeCallouts([{ key: "group", x: 1100, y: 300 }], W, H);
    const [left] = placeCallouts([{ key: "recenter", x: 300, y: 600 }], W, H);
    expect(right!.left).toBeGreaterThan(1100);
    expect(left!.left + CALLOUT.width).toBeLessThan(300);
  });

  it("keeps every label inside the window and clear of the others", () => {
    const placed = placeCallouts(
      [
        { key: "group", x: 1400, y: 120 },
        { key: "leafDirection", x: 1410, y: 130 },
        { key: "subgroup", x: 10, y: 890 },
      ],
      W,
      H,
    );
    for (const p of placed) {
      expect(p.left).toBeGreaterThanOrEqual(CALLOUT.gap);
      expect(p.left + CALLOUT.width).toBeLessThanOrEqual(W - CALLOUT.gap);
      expect(p.top).toBeGreaterThanOrEqual(CALLOUT.top);
      expect(p.top).toBeLessThanOrEqual(H - CALLOUT.bottom);
    }
    const [a, b] = placed;
    expect(Math.abs(a!.top - b!.top)).toBeGreaterThanOrEqual(CALLOUT.height);
  });

  it("leaves out elements outside the window", () => {
    expect(placeCallouts([{ key: "group", x: -50, y: 300 }], W, H)).toEqual([]);
  });
});

describe("ring around a labelled element", async () => {
  const { ringEdge, ringOf } = await import("../../src/ui/map/callouts.ts");

  it("is a circle for small, square elements and a pill for wide ones", () => {
    expect(ringOf(18, 18)).toEqual({ shape: "circle", r: 14 });
    expect(ringOf(200, 54)).toEqual({ shape: "pill", halfWidth: 105, halfHeight: 32 });
  });

  it("ends the leader line on the ring, not on the element", () => {
    const circle = ringEdge({ shape: "circle", r: 10 }, 0, 0, 30, 40);
    expect(Math.hypot(circle.x, circle.y)).toBeCloseTo(10);
    const pill = ringEdge({ shape: "pill", halfWidth: 100, halfHeight: 30 }, 0, 0, 0, 200);
    expect(pill).toEqual({ x: 0, y: 30 });
    const side = ringEdge({ shape: "pill", halfWidth: 100, halfHeight: 30 }, 0, 0, 400, 40);
    expect(side.x).toBeCloseTo(100);
  });
});
