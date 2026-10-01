import { describe, expect, it } from "vitest";
import type { PositionedMap, PositionedNode } from "../../src/core/types.ts";
import { readMapParams, toggle, writeMapParams } from "../../src/ui/hooks/mapParams.ts";
import { frameAt, lerpPath, staticFrame } from "../../src/ui/map/tween.ts";
import { fitView, PANEL_ROOM, zoomAt } from "../../src/ui/map/viewport.ts";

describe("map URL parameters", () => {
  it("reads defaults from an empty query", () => {
    const { lens, options } = readMapParams(new URLSearchParams());
    expect(lens).toBe("chapters");
    expect(options).toMatchObject({
      density: 4,
      showHousekeeping: false,
      folded: [],
      expanded: [],
    });
  });

  it("reads every parameter from datamodel.md §8", () => {
    const { options } = readMapParams(
      new URLSearchParams("lens=chapters&density=6&hk=1&fold=2,5.1&more=3"),
    );
    expect(options).toMatchObject({
      density: 6,
      showHousekeeping: true,
      folded: ["2", "5.1"],
      expanded: ["3"],
    });
  });

  it("ignores invalid values", () => {
    const { lens, options } = readMapParams(new URLSearchParams("lens=nope&density=99&fold=,"));
    expect(lens).toBe("chapters");
    expect(options.density).toBe(4);
    expect(options.folded).toEqual([]);
  });

  it("falls back to Chapters for lenses that aren't built yet", () => {
    expect(readMapParams(new URLSearchParams("lens=metro")).lens).toBe("chapters");
  });

  it("writes only what differs from the defaults and keeps other parameters", () => {
    const base = new URLSearchParams("x=1");
    const params = readMapParams(new URLSearchParams("density=6&fold=2"));
    expect(writeMapParams(base, params).toString()).toBe("x=1&density=6&fold=2");
    const defaults = readMapParams(new URLSearchParams());
    expect(writeMapParams(new URLSearchParams("density=6&hk=1"), defaults).toString()).toBe("");
  });

  it("toggles IDs in a list", () => {
    expect(toggle(["1", "2"], "2")).toEqual(["1"]);
    expect(toggle(["1"], "3")).toEqual(["1", "3"]);
  });
});

const node = (id: string, x: number, y: number, target?: string): PositionedNode => ({
  node: { id, kind: target ? "leaf" : "group", label: id, ...(target ? { target } : {}) },
  x,
  y,
  labelSide: "right",
  side: 1,
  depth: 1,
  text: id,
  textWidth: 10,
});

const map = (nodes: PositionedNode[], paths: Record<string, string> = {}): PositionedMap => ({
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  nodes,
  edges: Object.entries(paths).map(([to, path]) => ({
    edge: { from: "center", to, style: "twig" },
    path,
    width: 1.8,
  })),
});

describe("tween", () => {
  it("interpolates paths of the same shape number by number", () => {
    expect(lerpPath("M0 0C10 0 10 10 20 10", "M10 0C20 0 20 20 40 20", 0.5)).toBe(
      "M5 0C15 0 15 15 30 15",
    );
  });

  it("jumps between paths of a different shape", () => {
    expect(lerpPath("M0 0L1 1", "M0 0C1 1 2 2 3 3", 0.5)).toBe("M0 0L1 1");
    expect(lerpPath("M0 0L1 1", "M0 0C1 1 2 2 3 3", 1)).toBe("M0 0C1 1 2 2 3 3");
  });

  it("moves kept nodes, fades new ones in and old ones out", () => {
    const prev = map([node("a", 0, 0), node("gone", 5, 5)], { a: "M0 0L0 0" });
    const next = map([node("a", 100, 0), node("new", 9, 9)], { a: "M0 0L10 10" });
    const mid = frameAt(prev, next, 0.5);
    const at = (id: string) => mid.nodes.find((n) => n.p.node.id === id)!;
    expect(at("a").p.x).toBe(50);
    expect(at("a").opacity).toBe(1);
    expect(at("new").opacity).toBe(0.5);
    expect(at("gone")).toMatchObject({ opacity: 0.5, leaving: true });
    expect(mid.edges.find((e) => e.key === "center>a")?.e.path).toBe("M0 0L5 5");
  });

  it("moves the clicked leaf into the center when recentering", () => {
    const prev = map([node("center", 0, 0), node("2/Tony Buzan", 300, 80, "Tony Buzan")]);
    const nextCenter: PositionedNode = {
      ...node("center", 0, 0),
      node: { id: "center", kind: "center", label: "Tony Buzan", target: "Tony Buzan" },
      depth: 0,
    };
    const next = map([nextCenter]);
    const start = frameAt(prev, next, 0);
    expect(start.nodes.find((n) => !n.leaving && n.p.node.id === "center")?.p.x).toBe(300);
  });

  it("ends exactly at the next layout", () => {
    const next = map([node("a", 100, 0)]);
    expect(frameAt(map([node("a", 0, 0)]), next, 1).nodes.map((n) => n.p.x)).toEqual(
      staticFrame(next).nodes.map((n) => n.p.x),
    );
  });
});

describe("viewport", () => {
  const box = { x: -500, y: -200, width: 1000, height: 400 };

  it("fits the map between the panels, centered", () => {
    const v = fitView(box, 1440, 900);
    const left = box.x * v.k + v.tx;
    const right = (box.x + box.width) * v.k + v.tx;
    const top = box.y * v.k + v.ty;
    const bottom = (box.y + box.height) * v.k + v.ty;
    expect(left).toBeGreaterThanOrEqual(PANEL_ROOM.side - 0.01);
    expect(right).toBeLessThanOrEqual(1440 - PANEL_ROOM.side + 0.01);
    expect(top).toBeGreaterThanOrEqual(PANEL_ROOM.top - 0.01);
    expect(bottom).toBeLessThanOrEqual(900 - PANEL_ROOM.bottom + 0.01);
    expect((left + right) / 2).toBeCloseTo(720);
  });

  it("doesn't blow small maps up beyond 125 %", () => {
    expect(fitView({ x: -50, y: -20, width: 100, height: 40 }, 1440, 900).k).toBe(1.25);
  });

  it("zooms around the pointer", () => {
    const v = { k: 1, tx: 100, ty: 50 };
    const z = zoomAt(v, 2, 300, 250);
    // The map point under the pointer stays under the pointer.
    const mapX = (300 - v.tx) / v.k;
    expect(mapX * z.k + z.tx).toBeCloseTo(300);
    expect(z.k).toBe(2);
    expect(zoomAt(v, 100, 0, 0).k).toBe(3);
  });
});

describe("arrow-key navigation", async () => {
  const { neighbor: next, navNode } = await import("../../src/ui/map/navigation.ts");
  const { mindmapTree } = await import("../../src/layouts/mindmapTree.ts");
  const { buildChapters, chapters } = await import("../../src/lenses/chapters.ts");
  const { fixture, fixtureArticle, fixtureRedirects } = await import("./fixtures.ts");
  const f = fixture("en", "Mind map");
  const map = mindmapTree(
    buildChapters(fixtureArticle(f), { redirects: fixtureRedirects(f) }, chapters.defaults),
    { width: 1440, height: 900 },
  );
  const at = (id: string) => map.nodes.find((p) => p.node.id === id)!;
  const nodes = map.nodes.map(navNode);
  const neighbor = (_: unknown, id: string, key: Parameters<typeof next>[2]) =>
    next(nodes, id, key);

  it("goes from the center to the first branch on each side", () => {
    expect(neighbor(map.nodes, "center", "ArrowRight")).toBe("0");
    expect(at(neighbor(map.nodes, "center", "ArrowLeft")!).side).toBe(-1);
  });

  it("moves outward to the first child and back to the parent", () => {
    const child = neighbor(map.nodes, "0", "ArrowRight")!;
    expect(at(child).node.parent).toBe("0");
    expect(neighbor(map.nodes, child, "ArrowLeft")).toBe("0");
    expect(neighbor(map.nodes, "0", "ArrowLeft")).toBe("center");
  });

  it("mirrors left and right on the left side", () => {
    const left = neighbor(map.nodes, "center", "ArrowLeft")!;
    expect(at(neighbor(map.nodes, left, "ArrowLeft")!).node.parent).toBe(left);
    expect(neighbor(map.nodes, left, "ArrowRight")).toBe("center");
  });

  it("moves between siblings with up and down", () => {
    expect(neighbor(map.nodes, "0", "ArrowDown")).toBe("1");
    expect(neighbor(map.nodes, "1", "ArrowUp")).toBe("0");
    expect(neighbor(map.nodes, "0", "ArrowUp")).toBeUndefined();
  });
});
