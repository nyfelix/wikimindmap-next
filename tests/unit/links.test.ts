import { describe, expect, it } from "vitest";
import type { Enrichments, LensOptions, MapGraph, PositionedMap } from "../../src/core/types.ts";
import { bipolar } from "../../src/layouts/bipolar.ts";
import { nodeBoxes, type Box } from "../../src/layouts/geometry.ts";
import { getLens } from "../../src/lenses/index.ts";
import { buildLinks, formatTotal, links, MAX_IN } from "../../src/lenses/links.ts";
import {
  allFixtures,
  fixture,
  fixtureArticle,
  fixtureLinksBack,
  fixtureLinksHere,
  fixturePageviews,
  fixtureRedirects,
  type Fixture,
} from "./fixtures.ts";

function data(f: Fixture, withBack = true): Enrichments {
  const { linksHere, views } = fixtureLinksHere(f);
  return {
    redirects: fixtureRedirects(f),
    linksHere,
    pageviews: new Map([...views, ...fixturePageviews(f)]),
    ...(withBack ? fixtureLinksBack(f) : {}),
  };
}

function build(f: Fixture, options: Partial<LensOptions> = {}, withBack = true): MapGraph {
  return buildLinks(fixtureArticle(f), data(f, withBack), { ...links.defaults, ...options });
}

const children = (g: MapGraph, id: string) => g.nodes.filter((n) => n.parent === id);
const leaves = (g: MapGraph, id: string) => children(g, id).filter((n) => n.kind === "leaf");

describe("Links in / out lens", () => {
  const mindMap = fixture("en", "Mind map");
  const einstein = fixture("en", "Albert Einstein");

  it("is registered, uses the bipolar layout and asks for incoming links and page views", () => {
    expect(getLens("links")).toBe(links);
    expect(links.layout).toBe("bipolar");
    expect(links.needs).toEqual(expect.arrayContaining(["linksHere", "pageviews"]));
    expect(links.explain.steps.length).toBeGreaterThan(2);
    expect(links.explain.callouts.group?.title).toContain("{name}");
  });

  it("has three fixed sides: both ways on top, links out right, links here left", () => {
    const g = build(mindMap);
    const groups = children(g, "center");
    expect(groups.map((n) => [n.id, n.side, n.colorSlot])).toEqual([
      ["both", "top", 4],
      ["out", "right", 1],
      ["in", "left", 3],
    ]);
  });

  it("sorts every leaf by direction, with the matching symbol", () => {
    const g = build(mindMap);
    const { linksHere } = fixtureLinksHere(mindMap);
    const here = new Set(linksHere.titles);
    for (const n of leaves(g, "both")) {
      expect(here.has(n.target ?? "")).toBe(true);
      expect(n.direction).toBe("both");
    }
    for (const n of leaves(g, "out")) {
      expect(here.has(n.target ?? "")).toBe(false);
      expect(n.direction).toBe("out");
    }
    for (const n of leaves(g, "in")) expect(n.direction).toBe("in");
    // Tony Buzan and Mind map link each other.
    expect(leaves(build(mindMap, { density: 100 }), "both").map((n) => n.target)).toContain(
      "Tony Buzan",
    );
  });

  it("ranks each side by page views and shows up to density leaves per side", () => {
    const g = build(mindMap, { density: 3 });
    for (const side of ["both", "out", "in"]) {
      const shown = leaves(g, side);
      expect(shown.length).toBeLessThanOrEqual(3);
      const views = shown.map((n) => Number(n.meta?.views ?? -1));
      expect(views).toEqual([...views].sort((a, b) => b - a));
      expect(shown[0]?.weight).toBe(1);
    }
    expect(children(g, "in").some((n) => n.kind === "more")).toBe(true);
  });

  it("shows the totals per side, with 2,000+ when the list is capped", () => {
    const g = build(mindMap);
    const out = g.groups.find((x) => x.id === "out");
    expect(g.nodes.find((n) => n.id === "out")?.meta?.total).toBe(formatTotal(out?.count ?? 0));
    const e = build(einstein);
    expect(String(e.nodes.find((n) => n.id === "in")?.meta?.total)).toMatch(/^\d{1,3}(,\d{3})*\+$/);
    expect(formatTotal(2000, true)).toBe("2,000+");
  });

  it("leaves out of Links here what the article links to anywhere, infoboxes included", () => {
    const g = build(einstein, { expanded: ["in"] });
    const inside = new Set(fixtureLinksBack(einstein).linksChecked);
    for (const n of leaves(g, "in")) expect(inside.has(n.target ?? "")).toBe(false);
  });

  it("uses the links-back check when the incoming list is capped", () => {
    const checked = build(einstein, { density: 100 });
    expect(leaves(checked, "out").every((n) => n.direction === "out")).toBe(true);
    // Without the check, a capped list can't tell both ways from out.
    const unchecked = build(einstein, { density: 100 }, false);
    expect(leaves(unchecked, "out").some((n) => n.direction === "pending")).toBe(true);
    const count = (g: MapGraph) => g.groups.find((x) => x.id === "both")?.count ?? 0;
    expect(count(unchecked)).toBeLessThan(count(checked));
  });

  it("shows at most MAX_IN incoming links when all are expanded", () => {
    const g = build(einstein, { expanded: ["in"] });
    expect(leaves(g, "in")).toHaveLength(MAX_IN);
    expect(children(g, "in").find((n) => n.kind === "more")?.label).toBe("Show fewer");
  });

  it("folds each side", () => {
    const g = build(mindMap, { folded: ["in", "both"] });
    const group = g.nodes.find((n) => n.id === "in");
    expect(group?.folded).toBe(true);
    expect(group?.count).toBeGreaterThan(0);
    expect(children(g, "in")).toHaveLength(0);
    expect(children(g, "both")).toHaveLength(0);
    expect(leaves(g, "out").length).toBeGreaterThan(0);
  });

  it("shows an empty side as none linked", () => {
    const f = mindMap;
    const g = buildLinks(
      fixtureArticle(f),
      { ...data(f, false), linksHere: { titles: [], total: 0, capped: false } },
      links.defaults,
    );
    expect(g.nodes.find((n) => n.id === "in")?.empty).toBe(true);
    expect(g.nodes.find((n) => n.id === "both")?.empty).toBe(true);
  });

  it("is deterministic", () => {
    expect(build(mindMap)).toEqual(build(mindMap));
  });
});

const VIEWPORT = { width: 1440, height: 900 };
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

describe("bipolar layout", () => {
  for (const f of allFixtures()) {
    it(`has no overlapping labels for ${f.ref.lang}:${f.ref.title}`, () => {
      expect(collisions(bipolar(build(f), VIEWPORT))).toEqual([]);
      expect(collisions(bipolar(build(f, { density: 8 }), VIEWPORT))).toEqual([]);
    });
  }

  it("has no overlapping labels with everything expanded or folded", () => {
    const f = fixture("en", "Albert Einstein");
    expect(collisions(bipolar(build(f, { expanded: ["in", "out", "both"] }), VIEWPORT))).toEqual(
      [],
    );
    expect(collisions(bipolar(build(f, { folded: ["in", "out", "both"] }), VIEWPORT))).toEqual([]);
  });

  const map = bipolar(build(fixture("en", "Mind map")), VIEWPORT);
  const at = (id: string) => map.nodes.find((p) => p.node.id === id);

  it("puts links here left, links out right and both ways as pills above the center", () => {
    for (const p of map.nodes) {
      if (p.node.parent === "in") expect(p.x).toBeLessThan(0);
      if (p.node.parent === "out") expect(p.x).toBeGreaterThan(0);
      if (p.node.parent === "both") {
        expect(p.y).toBeLessThan(-100);
        if (p.node.kind === "leaf") expect(p.pill).toBe(true);
      }
    }
    expect(at("center")).toMatchObject({ x: 0, y: 0 });
  });

  it("draws zone labels in capitals with the total", () => {
    const zone = at("in");
    expect(zone?.labelSide).toBe("above");
    expect(zone?.text).toMatch(/^LINKS HERE · \d/);
  });

  it("keeps the columns below the band", () => {
    const band = Math.max(...map.nodes.filter((p) => p.node.parent === "both").map((p) => p.y));
    for (const id of ["in", "out"]) expect(at(id)!.y).toBeGreaterThan(band);
  });

  it("draws one arrow per column leaf, pointing the right way, and one double arrow to the band", () => {
    const arrows = map.edges.filter((e) => ["in", "out", "both"].includes(e.edge.style));
    const columnLeaves = map.nodes.filter(
      (p) =>
        p.node.kind === "leaf" && !p.pill && (p.node.parent === "in" || p.node.parent === "out"),
    );
    expect(arrows.filter((e) => e.edge.style !== "both")).toHaveLength(columnLeaves.length);
    expect(arrows.filter((e) => e.edge.style === "both")).toHaveLength(1);
    // "in" arrows end at the center (their path ends near x = 0), "out" arrows at the leaf.
    const end = (path: string) => Number(path.split(" ").slice(-2)[0]);
    for (const e of arrows) {
      if (e.edge.style === "in") expect(Math.abs(end(e.path))).toBeLessThan(200);
      if (e.edge.style === "out") expect(end(e.path)).toBeGreaterThan(200);
    }
  });

  it("frames every node in the viewBox", () => {
    const { x, y, width, height } = map.viewBox;
    for (const p of map.nodes)
      for (const b of nodeBoxes(p)) {
        expect(b.x0).toBeGreaterThanOrEqual(x);
        expect(b.x1).toBeLessThanOrEqual(x + width);
        expect(b.y0).toBeGreaterThanOrEqual(y);
        expect(b.y1).toBeLessThanOrEqual(y + height);
      }
  });
});
