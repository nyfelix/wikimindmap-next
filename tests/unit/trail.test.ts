import { describe, expect, it } from "vitest";
import type { ArticleRef, Trail } from "../../src/core/types.ts";
import {
  extendTrail,
  isTrail,
  renameCurrent,
  resolveTrail,
  startTrail,
} from "../../src/ui/hooks/trail.ts";

const en = (title: string): ArticleRef => ({ lang: "en", title });
const titles = (t: Trail) => t.steps.map((s) => s.ref.title);

describe("trail", () => {
  const start = startTrail(en("Mind map"), "chapters");
  const two = extendTrail(start, en("Tony Buzan"), "chapters", "Origin");
  const three = extendTrail(two, en("Chess"), "chapters");

  it("adds steps when recentering, with the chapter it came through", () => {
    expect(titles(three)).toEqual(["Mind map", "Tony Buzan", "Chess"]);
    expect(three.current).toBe(2);
    expect(two.steps[1]?.via).toBe("Origin");
  });

  it("cuts off later steps when recentering from an earlier one", () => {
    const back = { ...three, current: 0 };
    expect(titles(extendTrail(back, en("Concept map"), "chapters"))).toEqual([
      "Mind map",
      "Concept map",
    ]);
  });

  it("renames the current step after a redirect", () => {
    const renamed = renameCurrent(startTrail(en("Mindmap"), "chapters"), en("Mind map"));
    expect(titles(renamed)).toEqual(["Mind map"]);
  });

  it("checks the shape of stored trails", () => {
    expect(isTrail(three)).toBe(true);
    expect(isTrail({ steps: [], current: 0 })).toBe(false);
    expect(isTrail({ steps: three.steps, current: 7 })).toBe(false);
    expect(isTrail("nope")).toBe(false);
  });
});

describe("resolveTrail", () => {
  const start = startTrail(en("Mind map"), "chapters");
  const two = extendTrail(start, en("Tony Buzan"), "chapters");
  const three = extendTrail(two, en("Chess"), "chapters");

  it("uses the trail from history when it ends at the article shown", () => {
    expect(resolveTrail(two, undefined, en("Tony Buzan"), "chapters")).toBe(two);
  });

  it("keeps the steps ahead when going back", () => {
    // history.state of the Tony Buzan entry knows two steps; the saved trail knows three.
    const resolved = resolveTrail(two, three, en("Tony Buzan"), "chapters");
    expect(titles(resolved)).toEqual(["Mind map", "Tony Buzan", "Chess"]);
    expect(resolved.current).toBe(1);
  });

  it("uses the saved trail after a reload, at the step shown", () => {
    expect(resolveTrail(undefined, three, en("Chess"), "chapters")).toEqual(three);
    expect(resolveTrail(undefined, three, en("Mind map"), "chapters").current).toBe(0);
  });

  it("starts a new trail for an article that isn't on it", () => {
    expect(titles(resolveTrail(undefined, three, en("Zurich"), "chapters"))).toEqual(["Zurich"]);
    expect(titles(resolveTrail(undefined, "garbage", en("Zurich"), "chapters"))).toEqual([
      "Zurich",
    ]);
  });
});
