/**
 * Parses every fixture once, before the tests, and caches the Article as JSON. Lens and layout
 * tests read the cache: parsing 12 MB of HTML with happy-dom in every test worker at the same
 * time exhausts the heap. The cache key is the fixture's page.html content.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { parseParsoid } from "../../src/sources/parsoid.ts";
import { allFixtures, readText, siteinfo, articleCachePath } from "./fixtures.ts";

export default async function setup() {
  for (const f of allFixtures()) {
    const html = readText(f, "page.html");
    const hash = createHash("sha1").update(html).digest("hex").slice(0, 12);
    const path = articleCachePath(f);
    if (existsSync(path) && JSON.parse(readFileSync(path, "utf8")).hash === hash) continue;
    const window = new Window();
    const article = parseParsoid(
      html,
      f.ref,
      siteinfo(f.ref.lang),
      new window.DOMParser() as unknown as DOMParser,
      { fetchedAt: "2026-09-30T00:00:00.000Z", warn: () => {} },
    );
    await window.happyDOM.close();
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify({ hash, article }));
  }
}
