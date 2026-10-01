import { describe, expect, it } from "vitest";
import type { LensOptions, MapGraph, MapNode } from "../../src/core/types.ts";
import { buildChapters, chapters } from "../../src/lenses/chapters.ts";
import { getLens, lenses } from "../../src/lenses/index.ts";
import {
  allFixtures,
  fixture,
  fixtureArticle,
  fixtureRedirects,
  type Fixture,
} from "./fixtures.ts";

const mindMap = fixture("en", "Mind map");

function build(f: Fixture, options: Partial<LensOptions> = {}, linksBack?: Set<string>): MapGraph {
  const data = linksBack
    ? { redirects: fixtureRedirects(f), linksBack }
    : { redirects: fixtureRedirects(f) };
  return buildChapters(fixtureArticle(f), data, { ...chapters.defaults, ...options });
}

const byId = (graph: MapGraph) => new Map(graph.nodes.map((n) => [n.id, n]));
const childrenOf = (graph: MapGraph, id: string) => graph.nodes.filter((n) => n.parent === id);
const groupLabels = (graph: MapGraph) =>
  graph.nodes.filter((n) => n.kind === "group").map((n) => n.label);

describe("lens registry", () => {
  it("returns the Chapters lens, and falls back to it for lenses not built yet", () => {
    expect(getLens("chapters")).toBe(chapters);
    expect(getLens("metro")).toBe(chapters);
    expect(getLens("nonsense")).toBe(chapters);
    expect(lenses.chapters?.layout).toBe("mindmapTree");
  });
});

describe("Chapters lens on Mind map", () => {
  const graph = build(mindMap);

  it("puts the article in the center", () => {
    expect(graph.center).toMatchObject({ id: "center", kind: "center", label: "Mind map" });
  });

  it("starts with the introduction, then the chapters with links, without housekeeping", () => {
    expect(groupLabels(graph)).toEqual([
      "Introduction",
      "Origin",
      "Differences from other visualizations",
      "Research",
      "Tools",
      "Gallery",
    ]);
  });

  it("turns subchapters into subgroups and skips chapters without links", () => {
    const research = graph.nodes.find((n) => n.label === "Research")!;
    const subs = childrenOf(graph, research.id).filter((n) => n.kind === "subgroup");
    expect(subs.map((n) => [n.id, n.label])).toEqual([
      ["3.1", "Effectiveness"],
      ["3.2", "Features"],
    ]);
  });

  it("gives each chapter a color slot in turn; subchapters inherit it", () => {
    const groups = graph.nodes.filter((n) => n.kind === "group");
    expect(groups.map((n) => n.colorSlot)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const node of graph.nodes.filter((n) => n.kind !== "group")) {
      const parent = byId(graph).get(node.parent!)!;
      expect(node.colorSlot).toBe(parent.colorSlot);
    }
  });

  it("shows at most `density` leaves per group, then a +N more node", () => {
    const origin = graph.nodes.find((n) => n.label === "Origin")!;
    const kids = childrenOf(graph, origin.id);
    expect(kids.filter((n) => n.kind === "leaf")).toHaveLength(4);
    const more = kids.find((n) => n.kind === "more")!;
    expect(more.label).toMatch(/^\+\d+ more$/);
    expect(more.count).toBeGreaterThan(0);
  });

  it("keeps reading order", () => {
    const origin = graph.nodes.find((n) => n.label === "Origin")!;
    const leaves = childrenOf(graph, origin.id).filter((n) => n.kind === "leaf");
    expect(leaves.map((n) => n.label)).toEqual([
      "Popular psychology",
      "Tony Buzan",
      "Radial tree",
      leaves[3]!.label,
    ]);
  });

  it("merges links to the same article after redirects within a group", () => {
    const all = build(mindMap, { density: 50 });
    const differences = all.nodes.find((n) => n.label === "Differences from other visualizations")!;
    const leaves = childrenOf(all, differences.id).map((n) => n.label);
    expect(leaves.filter((l) => l === "Concept map")).toHaveLength(1);
    expect(leaves).not.toContain("Concept maps");
  });

  it("marks every leaf pending until links back are known", () => {
    const leaves = graph.nodes.filter((n) => n.kind === "leaf");
    expect(leaves.every((n) => n.direction === "pending")).toBe(true);
    const known = build(mindMap, {}, new Set(["Tony Buzan"]));
    const directions = known.nodes.filter((n) => n.kind === "leaf");
    expect(directions.find((n) => n.target === "Tony Buzan")?.direction).toBe("both");
    expect(directions.find((n) => n.target === "Radial tree")?.direction).toBe("out");
    // Titles the check hasn't covered yet stay pending.
    const partial = buildChapters(
      fixtureArticle(mindMap),
      {
        redirects: fixtureRedirects(mindMap),
        linksBack: new Set(),
        linksChecked: new Set(["Tony Buzan"]),
      },
      chapters.defaults,
    ).nodes.filter((n) => n.kind === "leaf");
    expect(partial.find((n) => n.target === "Tony Buzan")?.direction).toBe("out");
    expect(partial.find((n) => n.target === "Radial tree")?.direction).toBe("pending");
  });

  it("records the chapter of every leaf for the preview card", () => {
    const leaf = graph.nodes.find((n) => n.kind === "leaf" && n.parent === "3.1")!;
    expect(leaf.meta?.chapter).toBe("Research › Effectiveness");
  });

  it("has unique IDs, and an edge for every node", () => {
    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(graph.edges.map((e) => e.to).sort()).toEqual([...ids].sort());
    for (const edge of graph.edges) {
      expect(edge.from === "center" || ids.includes(edge.from)).toBe(true);
    }
  });

  it("sets folded on every node with children", () => {
    for (const node of graph.nodes) {
      const hasChildren = graph.nodes.some((n) => n.parent === node.id);
      if (hasChildren) expect(node.folded).toBe(false);
      if (node.kind === "leaf" || node.kind === "more") expect(node.folded).toBeUndefined();
    }
  });

  it("lists the first-level groups in the legend", () => {
    expect(graph.groups.map((g) => g.label)).toEqual(groupLabels(graph));
    expect(graph.groups[0]).toMatchObject({ id: "0", colorSlot: 1 });
  });

  it("is deterministic", () => {
    expect(build(mindMap)).toEqual(graph);
  });
});

describe("Chapters lens options", () => {
  it("shows housekeeping chapters muted when asked", () => {
    const graph = build(mindMap, { showHousekeeping: true });
    const seeAlso = graph.nodes.find((n) => n.label === "See also")!;
    expect(seeAlso.kind).toBe("group");
    expect(seeAlso.colorSlot).toBeUndefined();
    // References only hold footnote links, which aren't shown by default.
    expect(groupLabels(graph)).not.toContain("References");
  });

  it("shows only body and hatnote links by default", () => {
    const article = fixtureArticle(mindMap);
    const navboxOnly = article.sections
      .flatMap((s) => s.links)
      .filter((l) => l.origin === "navbox")
      .map((l) => l.target)
      .find(
        (t) =>
          !article.sections.some((s) =>
            s.links.some((l) => l.target === t && l.origin !== "navbox"),
          ) && !article.lead.links.some((l) => l.target === t),
      )!;
    const shown = (g: MapGraph) => g.nodes.some((n) => n.target === navboxOnly);
    expect(shown(build(mindMap, { density: 100, showHousekeeping: true }))).toBe(false);
    expect(
      shown(
        build(mindMap, {
          density: 100,
          showHousekeeping: true,
          includeOrigins: ["body", "hatnote", "navbox"],
        }),
      ),
    ).toBe(true);
  });

  it("folds a group: no children, the hidden link count instead", () => {
    const open = build(mindMap);
    const graph = build(mindMap, { folded: ["1"] });
    const origin = byId(graph).get("1")!;
    expect(origin.folded).toBe(true);
    expect(origin.count).toBe(
      build(mindMap, { density: 100 }).nodes.filter((n) => n.parent === "1").length,
    );
    expect(childrenOf(graph, "1")).toHaveLength(0);
    expect(graph.nodes.length).toBeLessThan(open.nodes.length);
  });

  it("folds subchapters on their own", () => {
    const graph = build(mindMap, { folded: ["3.1"] });
    expect(byId(graph).get("3")!.folded).toBe(false);
    expect(byId(graph).get("3.1")!.folded).toBe(true);
    expect(childrenOf(graph, "3.1")).toHaveLength(0);
  });

  it("shows all links of an expanded group, ending with Show fewer", () => {
    const graph = build(mindMap, { expanded: ["1"] });
    const kids = childrenOf(graph, "1");
    expect(kids.filter((n) => n.kind === "leaf").length).toBeGreaterThan(4);
    expect(kids.at(-1)).toMatchObject({ kind: "more", label: "Show fewer" });
    // Other groups keep the density.
    expect(childrenOf(graph, "2").filter((n) => n.kind === "leaf").length).toBeLessThanOrEqual(4);
  });

  it("respects the density", () => {
    for (const density of [2, 8]) {
      const graph = build(mindMap, { density });
      for (const group of graph.nodes.filter((n) => n.kind === "group" || n.kind === "subgroup")) {
        expect(
          childrenOf(graph, group.id).filter((n) => n.kind === "leaf").length,
        ).toBeLessThanOrEqual(density);
      }
    }
  });
});

describe("Chapters lens on every fixture", () => {
  for (const f of allFixtures()) {
    it(`${f.ref.lang}:${f.ref.title}`, () => {
      const graph = build(f);
      expect(graph.nodes.length).toBeGreaterThan(5);
      const leaves = graph.nodes.filter(
        (n): n is MapNode & { target: string } => n.kind === "leaf",
      );
      // The center never appears as its own leaf.
      expect(leaves.some((n) => n.target === f.ref.title)).toBe(false);
      // Leaves are unique within their group.
      for (const group of new Set(leaves.map((n) => n.parent))) {
        const targets = leaves.filter((n) => n.parent === group).map((n) => n.target);
        expect(new Set(targets).size).toBe(targets.length);
      }
    });
  }

  it("keeps red links, flagged", () => {
    const graph = build(fixture("fr", "Carte heuristique"), { density: 100 });
    expect(graph.nodes.some((n) => n.kind === "leaf" && n.redLink)).toBe(true);
  });

  it("names the lead per language", () => {
    expect(groupLabels(build(fixture("de", "Mindmap")))[0]).toBe("Einleitung");
  });
});
