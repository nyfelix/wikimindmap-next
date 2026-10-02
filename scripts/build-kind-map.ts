/**
 * Builds src/lenses/kindMap.json (TS-13): Wikidata class (QID) → [kind, English label].
 *
 *   node scripts/build-kind-map.ts
 *
 * 1. Takes the P31 classes of every link in the recorded starter articles (tests/fixtures),
 *    the classes real maps meet, plus a few seeds, and keeps the ~1,000 most common.
 * 2. Walks each class's P279 superclasses (Wikidata query service) to the roots below. A class
 *    reaching several roots takes the first kind in KIND_PRECEDENCE. Others are "concepts".
 *
 * Regenerate by hand when kinds look wrong (README.md); the table is checked in.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Kind } from "../src/core/types.ts";
import { API_USER_AGENT, createHttpClient } from "../src/sources/http.ts";
import {
  classesFrom,
  fetchWikidata,
  KIND_PRECEDENCE,
  SPARQL_URL,
  type KindMap,
} from "../src/sources/wikidata.ts";

const ROOT = join(import.meta.dirname, "..");
const FIXTURES = join(ROOT, "tests", "fixtures");
const OUT = join(ROOT, "src", "lenses", "kindMap.json");
const LIMIT = 1000;

/** Rules from the preview (concepts/lens-kinds.html): the roots of each kind. */
const ROOTS: Record<Exclude<Kind, "concepts">, string[]> = {
  people: ["Q5", "Q95074", "Q15632617"], // human, fictional character, fictional human
  places: ["Q2221906", "Q618123", "Q17334923", "Q41176", "Q515", "Q6256"], // geographic location, geographical feature, location, building, city, country
  orgs: ["Q43229"], // organization
  works: ["Q17537576", "Q7397", "Q838948"], // creative work, software, work of art
  // "occurrence" (Q1190554) is too broad: it reaches currency, hobby, contract…
  events: [
    "Q1656682", // planned event
    "Q13418847", // historical event
    "Q180684", // conflict
    "Q350604", // armed conflict
    "Q178561", // battle
    "Q645883", // military operation
    "Q40231", // public election
    "Q13406554", // sports competition
    "Q27020041", // sports season
    "Q132241", // festival
    "Q2761147", // meeting
    "Q3839081", // disaster
  ],
};

/** Common classes the sample may miss. */
const SEEDS = [
  "Q5",
  "Q95074", // fictional character
  "Q15632617", // fictional human
  "Q3658341", // literary character
  "Q15773347", // film character
  "Q15711870", // animated character
  "Q515",
  "Q6256",
  "Q43229",
  "Q4830453",
  "Q3918",
  "Q7725634",
  "Q11424",
  "Q7397",
  "Q178561",
  "Q198",
  "Q1656682",
  "Q11862829",
  "Q151885",
  "Q16521",
  "Q8502",
  "Q4022",
  "Q23397",
];

const http = createHttpClient({ headers: { "User-Agent": API_USER_AGENT } });

async function sparql<T>(query: string): Promise<T> {
  return (await http.getJson<T>(`${SPARQL_URL}?format=json&query=${encodeURIComponent(query)}`))
    .data;
}

async function sampleClasses(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const lang of await readdir(FIXTURES)) {
    if (lang.includes(".")) continue;
    const titles = new Set<string>();
    for (const dir of await readdir(join(FIXTURES, lang))) {
      if (dir.includes(".json")) continue;
      const path = join(FIXTURES, lang, dir, "linksback.json");
      const recorded = JSON.parse(await readFile(path, "utf8")) as { checked: string[] };
      recorded.checked.forEach((t) => titles.add(t));
    }
    console.log(`${lang}: ${titles.size} titles`);
    const data = await fetchWikidata(lang, titles, http);
    for (const classes of classesFrom(data.sparql).values()) {
      for (const c of classes) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts;
}

async function classify(classes: string[]): Promise<KindMap> {
  const roots = Object.entries(ROOTS).flatMap(([kind, qids]) =>
    qids.map((q) => [q, kind as Kind] as const),
  );
  const kindOfRoot = new Map(roots);
  const map: KindMap = {};
  for (let i = 0; i < classes.length; i += 40) {
    const batch = classes.slice(i, i + 40);
    const values = batch.map((c) => `wd:${c}`).join(" ");
    const reach = await sparql<{
      results: { bindings: { class: { value: string }; root: { value: string } }[] };
    }>(
      `SELECT ?class ?root WHERE { VALUES ?class { ${values} } VALUES ?root { ${roots.map(([q]) => `wd:${q}`).join(" ")} } ?class wdt:P279* ?root }`,
    );
    const labels = await sparql<{
      results: { bindings: { class: { value: string }; label: { value: string } }[] };
    }>(
      `SELECT ?class ?label WHERE { VALUES ?class { ${values} } ?class rdfs:label ?label FILTER(LANG(?label) = "en") }`,
    );
    const label = new Map(labels.results.bindings.map((b) => [qid(b.class.value), b.label.value]));
    const kinds = new Map<string, Kind[]>();
    for (const b of reach.results.bindings) {
      const kind = kindOfRoot.get(qid(b.root.value));
      if (kind) kinds.set(qid(b.class.value), [...(kinds.get(qid(b.class.value)) ?? []), kind]);
    }
    for (const c of batch) {
      const found = (kinds.get(c) ?? []).sort(
        (a, b) => KIND_PRECEDENCE.indexOf(a) - KIND_PRECEDENCE.indexOf(b),
      );
      map[c] = [found[0] ?? "concepts", label.get(c) ?? c];
    }
    process.stdout.write(`\rclassified ${Math.min(i + 40, classes.length)}/${classes.length}`);
  }
  process.stdout.write("\n");
  return map;
}

const qid = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

async function main() {
  const counts = await sampleClasses();
  for (const s of SEEDS) counts.set(s, (counts.get(s) ?? 0) + 1_000_000);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([c]) => c);
  console.log(`${counts.size} classes seen, keeping ${top.length}`);
  const map = await classify(top);
  const sorted = Object.fromEntries(
    Object.entries(map).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1))),
  );
  await writeFile(OUT, JSON.stringify(sorted, null, 0).replaceAll('],"', '],\n"') + "\n");
  const tally: Record<string, number> = {};
  for (const [kind] of Object.values(map)) tally[kind] = (tally[kind] ?? 0) + 1;
  console.log("kinds:", tally);
}

await main();
