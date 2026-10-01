import { describe, expect, it } from "vitest";
import type { LensOptions, PositionedMap, PositionedNode } from "../../src/core/types.ts";
import { mindmapTree, nodeBoxes, type Box } from "../../src/layouts/mindmapTree.ts";
import { buildChapters, chapters } from "../../src/lenses/chapters.ts";
import {
  allFixtures,
  fixture,
  fixtureArticle,
  fixtureRedirects,
  type Fixture,
} from "./fixtures.ts";

const VIEWPORT = { width: 1440, height: 900 };

function layout(f: Fixture, options: Partial<LensOptions> = {}): PositionedMap {
  const graph = buildChapters(
    fixtureArticle(f),
    { redirects: fixtureRedirects(f) },
    { ...chapters.defaults, ...options },
  );
  return mindmapTree(graph, VIEWPORT);
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function collisions(map: PositionedMap): string[] {
  const boxes = map.nodes.flatMap((p) => nodeBoxes(p).map((box) => ({ p, box })));
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.p !== b.p && overlaps(a.box, b.box)) found.push(`${a.p.node.id} × ${b.p.node.id}`);
    }
  }
  return found;
}

describe("mindmapTree", () => {
  for (const f of allFixtures()) {
    it(`has no overlapping labels for ${f.ref.lang}:${f.ref.title} at density 4`, () => {
      expect(collisions(layout(f))).toEqual([]);
    });
  }

  it("has no overlapping labels with See also, all links of a group, or folded groups", () => {
    const f = fixture("en", "World War II");
    expect(collisions(layout(f, { showHousekeeping: true, density: 8 }))).toEqual([]);
    expect(collisions(layout(f, { expanded: ["0", "4.1"] }))).toEqual([]);
    expect(collisions(layout(f, { folded: ["1", "4", "5.2"] }))).toEqual([]);
  });

  const map = layout(fixture("en", "Mind map"));
  const groups = map.nodes.filter((p) => p.node.kind === "group");
  const rowsOf = (side: 1 | -1) =>
    map.nodes.filter((p) => p.side === side && (p.node.kind === "leaf" || p.node.kind === "more"))
      .length;

  it("puts the center at the origin", () => {
    expect(map.nodes[0]).toMatchObject({ x: 0, y: 0, depth: 0, labelSide: "center" });
  });

  it("splits the groups between both sides with a similar number of rows", () => {
    expect(groups.some((p) => p.side === 1)).toBe(true);
    expect(groups.some((p) => p.side === -1)).toBe(true);
    expect(Math.abs(rowsOf(1) - rowsOf(-1))).toBeLessThanOrEqual(6);
  });

  it("runs clockwise from the top right", () => {
    const right = groups.filter((p) => p.side === 1);
    const left = groups.filter((p) => p.side === -1);
    // In lens order (group IDs count up): right side top to bottom, left side bottom to top.
    const lensOrder = (list: PositionedNode[]) =>
      list.map((p) => p.node.id).sort((a, b) => Number(a) - Number(b));
    const byY = (list: PositionedNode[], dir: 1 | -1) =>
      [...list].sort((a, b) => dir * (a.y - b.y)).map((p) => p.node.id);
    expect(byY(right, 1)).toEqual(lensOrder(right));
    expect(byY(left, -1)).toEqual(lensOrder(left));
    expect(Math.max(...right.map((p) => Number(p.node.id)))).toBeLessThan(
      Math.min(...left.map((p) => Number(p.node.id))),
    );
    expect(right[0]?.node.label).toBe("Introduction");
  });

  it("places children further out than their parent", () => {
    const at = new Map(map.nodes.map((p) => [p.node.id, p]));
    for (const p of map.nodes) {
      if (!p.node.parent) continue;
      const parent = at.get(p.node.parent)!;
      expect(Math.abs(p.x)).toBeGreaterThan(Math.abs(parent.x));
      expect(Math.sign(p.x)).toBe(p.side);
    }
  });

  it("draws an edge for every node, tapered for branches and stroked for twigs", () => {
    expect(map.edges).toHaveLength(map.nodes.length - 1);
    for (const e of map.edges) {
      expect(e.path).toMatch(/^M[-\d.]+ [-\d.]+C/);
      if (e.edge.style === "twig") expect(e.path).not.toContain("Z");
      else expect(e.path.endsWith("Z")).toBe(true);
    }
  });

  it("frames every label in the viewBox", () => {
    const { x, y, width, height } = map.viewBox;
    for (const p of map.nodes) {
      for (const b of nodeBoxes(p)) {
        expect(b.x0).toBeGreaterThanOrEqual(x);
        expect(b.x1).toBeLessThanOrEqual(x + width);
        expect(b.y0).toBeGreaterThanOrEqual(y);
        expect(b.y1).toBeLessThanOrEqual(y + height);
      }
    }
  });

  it("shortens very long labels", () => {
    const long = layout(fixture("de", "Albert Einstein"), { showHousekeeping: true });
    const label = long.nodes.find((p) => p.node.label.startsWith("Weitere Darstellungen"));
    expect(label?.text.endsWith("…")).toBe(true);
    expect(label!.text.length).toBeLessThanOrEqual(40);
  });

  it("uses the measure function it is given", () => {
    const graph = buildChapters(
      fixtureArticle(fixture("en", "Mind map")),
      { redirects: new Map() },
      chapters.defaults,
    );
    const wide = mindmapTree(graph, VIEWPORT, { measure: (t) => t.length * 20 });
    const narrow = mindmapTree(graph, VIEWPORT, { measure: (t) => t.length * 5 });
    expect(wide.viewBox.width).toBeGreaterThan(narrow.viewBox.width);
  });
});
