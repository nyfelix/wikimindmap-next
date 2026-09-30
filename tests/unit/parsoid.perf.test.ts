// Own file, so it runs in a fresh worker: the fixture tests leave a full heap behind.
import { Window } from "happy-dom";
import { expect, it } from "vitest";
import { parseParsoid } from "../../src/sources/parsoid.ts";
import { fixture, readText, siteinfo } from "./fixtures.ts";

it("extracts World War II, the longest fixture, in < 150 ms", async () => {
  const f = fixture("en", "World War II");
  const html = readText(f, "page.html");
  const window = new Window();
  // Building the DOM is the browser's job (native DOMParser); happy-dom's is much slower,
  // so the budget covers our extraction only.
  const doc = new window.DOMParser().parseFromString(html, "text/html") as unknown as Document;
  const given = { parseFromString: () => doc };

  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    parseParsoid(html, f.ref, siteinfo("en"), given, { fetchedAt: "2026-09-30T00:00:00.000Z" });
    times.push(performance.now() - start);
  }
  await window.happyDOM.close();
  expect(Math.min(...times)).toBeLessThan(150);
});
