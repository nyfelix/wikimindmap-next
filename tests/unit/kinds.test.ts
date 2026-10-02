import { describe, expect, it } from "vitest";
import type { LensOptions, MapGraph } from "../../src/core/types.ts";
import { mindmapTree, nodeBoxes, type Box } from "../../src/layouts/mindmapTree.ts";
import { buildKinds, KINDS, kinds } from "../../src/lenses/kinds.ts";
import { getLens } from "../../src/lenses/index.ts";
import { sumPageviews } from "../../src/sources/pageviews.ts";
import {
  allFixtures,
  fixture,
  fixtureArticle,
  fixtureKinds,
  fixturePageviews,
  fixtureRedirects,
  readJson,
  type Fixture,
} from "./fixtures.ts";

function build(f: Fixture, options: Partial<LensOptions> = {}): MapGraph {
  return buildKinds(
    fixtureArticle(f),
    { redirects: fixtureRedirects(f), kinds: fixtureKinds(f), pageviews: fixturePageviews(f) },
    { ...kinds.defaults, ...options },
  );
}

const children = (g: MapGraph, id: string) => g.nodes.filter((n) => n.parent === id);

describe("kinds and page views from the recorded responses", () => {
  const einstein = fixture("en", "Albert Einstein");

  it("knows people, places, organizations and works", () => {
    const k = fixtureKinds(einstein);
    expect(k.get("Max Planck")?.kind).toBe("people");
    expect(k.get("Ulm")?.kind).toBe("places");
    expect(k.get("Max Planck")?.instanceOf).toContain("human");
    const counts = new Set([...k.values()].map((i) => i.kind));
    expect(counts).toEqual(new Set(["people", "places", "orgs", "works", "concepts", "events"]));
  });

  it("sums 30 days of views and follows pvipcontinue", () => {
    const raw = readJson<{ titles: string[]; responses: { continue?: object }[] }>(
      einstein,
      "pageviews.json",
    );
    expect(raw.responses.some((r) => r.continue)).toBe(true);
    const views = fixturePageviews(einstein);
    expect(views.get("Max Planck")).toBeGreaterThan(1000);
    expect(views.size).toBeGreaterThan(raw.titles.length * 0.9);
  });

  it("maps views back through normalization and redirects", () => {
    const views = sumPageviews(
      ["mind-map"],
      [
        {
          query: {
            normalized: [{ from: "mind-map", to: "Mind-map" }],
            redirects: [{ from: "Mind-map", to: "Mind map" }],
            pages: [
              {
                title: "Mind map",
                pageviews: { "2026-09-01": 10, "2026-09-02": null, "2026-09-03": 5 },
              },
            ],
          },
        },
      ],
    );
    expect(views.get("mind-map")).toBe(15);
  });
});

describe("Kinds lens", () => {
  const f = fixture("en", "Albert Einstein");
  const graph = build(f);

  it("is registered", () => {
    expect(getLens("kinds")).toBe(kinds);
  });

  it("has six fixed branches in fixed places, every time", () => {
    const groups = graph.nodes.filter((n) => n.kind === "group");
    expect(groups.map((g) => [g.id, g.side])).toEqual(KINDS.map((k) => [k.id, k.side]));
    expect(
      build(fixture("en", "Tony Buzan"))
        .nodes.filter((n) => n.kind === "group")
        .map((g) => g.id),
    ).toEqual(KINDS.map((k) => k.id));
  });

  it("ranks leaves by page views", () => {
    const people = children(graph, "people").filter((n) => n.kind === "leaf");
    const views = people.map((n) => Number(n.meta?.views));
    expect(views).toEqual([...views].sort((a, b) => b - a));
    expect(people).toHaveLength(5);
    expect(people[0]!.weight).toBeGreaterThan(0);
    expect(Math.max(...graph.nodes.map((n) => n.weight ?? 0))).toBe(1);
  });

  it("puts kind, instance of and views in the leaf for the preview card", () => {
    const planck = build(f, { density: 200 }).nodes.find((n) => n.target === "Max Planck")!;
    expect(planck.meta).toMatchObject({ kind: "People", instanceOf: "human" });
    expect(Number(planck.meta?.views)).toBeGreaterThan(0);
  });

  it("shows an empty branch as empty, with a note", () => {
    const g = build(fixture("en", "Tony Buzan"));
    const empty = g.nodes.filter((n) => n.empty);
    expect(empty.length).toBeGreaterThan(0);
    for (const e of empty) expect(children(g, e.id)).toHaveLength(0);
    expect(g.notes?.some((n) => n.endsWith("none linked"))).toBe(true);
  });

  it("folds a branch", () => {
    const g = build(f, { folded: ["people"] });
    expect(g.nodes.find((n) => n.id === "people")).toMatchObject({ folded: true });
    expect(children(g, "people")).toHaveLength(0);
  });

  it("leaves out red links and puts unknown kinds under Concepts", () => {
    const g = buildKinds(fixtureArticle(f), { redirects: fixtureRedirects(f) }, kinds.defaults);
    // Without Wikidata, everything lands in Concepts.
    expect(g.groups.filter((x) => x.count > 0).map((x) => x.id)).toEqual(["concepts"]);
    expect(g.nodes.some((n) => n.redLink)).toBe(false);
  });

  const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  for (const fx of allFixtures()) {
    it(`lays out ${fx.ref.lang}:${fx.ref.title} without overlapping labels`, () => {
      const map = mindmapTree(build(fx), { width: 1440, height: 900 });
      const boxes = map.nodes.flatMap((p) => nodeBoxes(p).map((box) => ({ p, box })));
      const hits: string[] = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          if (boxes[i]!.p !== boxes[j]!.p && overlaps(boxes[i]!.box, boxes[j]!.box))
            hits.push(`${boxes[i]!.p.node.id} × ${boxes[j]!.p.node.id}`);
      expect(hits).toEqual([]);
      // Fixed places: people on the left, concepts on the right.
      expect(map.nodes.find((p) => p.node.id === "people")!.side).toBe(-1);
      expect(map.nodes.find((p) => p.node.id === "concepts")!.side).toBe(1);
    });
  }
});
