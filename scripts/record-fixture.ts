/**
 * Records real API responses into tests/fixtures/ (datamodel.md §9).
 *
 *   npm run fixtures -- en "Mind map"      one article
 *   npm run fixtures -- --starter          the whole starter set
 *   npm run fixtures -- en "Mind map" --fallback   also the action=parse fallback responses
 *   npm run fixtures -- --linksback-only   re-checks linksback.json for the recorded pages
 *   npm run fixtures -- --languages        records sitematrix.json (all Wikipedias, US-09)
 *
 * Writes, per article: page.html, headers.json, summary.json, redirects.json, linksback.json,
 * and per language: siteinfo.json. With --fallback also fallback.json (TS-07). Enrichments for later milestones
 * (linksback, pageviews, wikidata, linkshere) are added by their stories.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Window } from "happy-dom";
import { pageHtmlUrl, titleFromPageUrl } from "../src/sources/article.ts";
import { API_USER_AGENT, actionUrl, createHttpClient } from "../src/sources/http.ts";
import { loadFallback } from "../src/sources/parseFallback.ts";
import { parseParsoid } from "../src/sources/parsoid.ts";
import { centerRedirects, linksBack } from "../src/sources/linksBack.ts";
import { redirectPairs, type RedirectsResponse } from "../src/sources/redirects.ts";
import { parseSiteinfo, type SiteinfoResponse } from "../src/sources/siteinfo.ts";
import { buildChapters, chapters } from "../src/lenses/chapters.ts";

const STARTER: Record<string, string[]> = {
  en: [
    "Mind map",
    "Tony Buzan",
    "Concept map",
    "Zürich",
    "Albert Einstein",
    "Photosynthesis",
    "World War II",
    "Python (programming language)",
    "Chess",
    "Mount Everest",
  ],
  de: ["Mindmap", "Zürich", "Albert Einstein", "Photosynthese"],
  fr: ["Carte heuristique"],
};

const ROOT = join(import.meta.dirname, "..", "tests", "fixtures");
const BATCH = 50;

// Node may set User-Agent (browsers can't); Wikimedia asks scripts to identify themselves.
const http = createHttpClient({ headers: { "User-Agent": API_USER_AGENT } });

async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

const siteinfos = new Map<string, SiteinfoResponse>();

async function recordSiteinfo(lang: string) {
  const url = actionUrl(lang, { meta: "siteinfo", siprop: "general|namespaces|namespacealiases" });
  const { data } = await http.getJson<
    SiteinfoResponse & { query: { general?: Record<string, unknown> } }
  >(url);
  // Drop fields that change on every request, so re-recording doesn't churn the file.
  delete data.query.general?.time;
  delete data.query.general?.["max-page-id"];
  siteinfos.set(lang, data);
  await mkdir(join(ROOT, lang), { recursive: true });
  await writeJson(join(ROOT, lang, "siteinfo.json"), data);
}

/**
 * Which leaves link back to the center, for every leaf the Chapters lens can show (all links,
 * See also on), so tests and the mocked e2e network know every direction.
 */
async function recordLinksBack(
  lang: string,
  title: string,
  html: string,
  batches: RedirectsResponse[],
) {
  const window = new Window();
  const siteinfo = siteinfos.get(lang);
  if (!siteinfo) throw new Error(`No siteinfo for ${lang}`);
  const article = parseParsoid(
    html,
    { lang, title },
    parseSiteinfo(lang, siteinfo),
    new window.DOMParser() as unknown as DOMParser,
    { warn: () => {} },
  );
  await window.happyDOM.close();
  const redirects = new Map<string, string>();
  for (const batch of batches) {
    const asked = [...(batch.query?.normalized ?? []), ...(batch.query?.redirects ?? [])].map(
      (r) => r.from,
    );
    for (const [from, to] of redirectPairs(asked, batch)) redirects.set(from, to);
  }
  const graph = buildChapters(
    article,
    { redirects },
    { ...chapters.defaults, density: 10_000, showHousekeeping: true },
  );
  const checked = [
    ...new Set(graph.nodes.flatMap((n) => (n.kind === "leaf" && n.target ? [n.target] : []))),
  ].sort();
  const aliases = await centerRedirects(lang, title, http);
  const back = await linksBack(lang, title, checked, { client: http, aliases });
  return {
    center: title,
    aliases,
    checked,
    back: [...back].filter((t) => checked.includes(t)).sort(),
  };
}

/** Titles of links that Parsoid marks as pointing to a redirect page. */
function redirectLinkTitles(html: string): string[] {
  const window = new Window();
  const doc = new window.DOMParser().parseFromString(html, "text/html");
  const titles = new Set<string>();
  for (const a of doc.querySelectorAll('a[rel~="mw:WikiLink"].mw-redirect')) {
    const title = a.getAttribute("title");
    if (title) titles.add(title);
  }
  void window.happyDOM.close();
  return [...titles];
}

async function recordArticle(lang: string, requested: string, fallback: boolean) {
  const page = await http.getText(pageHtmlUrl({ lang, title: requested }));
  // A redirect title is answered with 307 to the target; store under the real title.
  const title = titleFromPageUrl(page.url) ?? requested;
  const dir = join(ROOT, lang, title.replaceAll(" ", "_"));
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, "page.html"), page.data);
  const keep = ["content-type", "content-language", "etag", "last-modified"];
  await writeJson(join(dir, "headers.json"), {
    url: page.url,
    status: page.status,
    headers: Object.fromEntries(
      keep.filter((k) => k in page.headers).map((k) => [k, page.headers[k]]),
    ),
  });

  const summary = await http.getJson(
    actionUrl(lang, {
      prop: "extracts|pageimages|description",
      exintro: 1,
      explaintext: 1,
      exsentences: 3,
      piprop: "thumbnail",
      pithumbsize: 320,
      redirects: 1,
      titles: title,
    }),
  );
  await writeJson(join(dir, "summary.json"), summary.data);

  // One raw response per batch of 50, in request order.
  const targets = redirectLinkTitles(page.data);
  const batches: RedirectsResponse[] = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    const titles = targets.slice(i, i + BATCH).join("|");
    batches.push(
      (await http.getJson<RedirectsResponse>(actionUrl(lang, { redirects: 1, titles }))).data,
    );
  }
  await writeJson(join(dir, "redirects.json"), batches);
  const back = await recordLinksBack(lang, title, page.data, batches);
  await writeJson(join(dir, "linksback.json"), back);

  if (fallback)
    await writeJson(join(dir, "fallback.json"), await loadFallback({ lang, title }, http));

  console.log(
    `${lang}:${title}  ${Math.round(page.data.length / 1024)} kB, ${targets.length} redirect links, ` +
      `${back.back.length}/${back.checked.length} link back`,
  );
}

/** The site matrix: every Wikipedia language, for the language picker. */
async function recordLanguages() {
  const { data } = await http.getJson(
    actionUrl(
      "meta",
      {
        action: "sitematrix",
        smtype: "language",
        smlangprop: "code|name|localname|site",
        smsiteprop: "url|code",
      },
      "meta.wikimedia.org",
    ),
  );
  await writeJson(join(ROOT, "sitematrix.json"), data);
  console.log("sitematrix.json");
}

/** Re-records linksback.json from the stored page.html and redirects.json of every fixture. */
async function relinkAll() {
  const langs = (await readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory());
  for (const { name: lang } of langs) {
    siteinfos.set(
      lang,
      JSON.parse(await readFile(join(ROOT, lang, "siteinfo.json"), "utf8")) as SiteinfoResponse,
    );
    for (const entry of await readdir(join(ROOT, lang), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(ROOT, lang, entry.name);
      const title = entry.name.replaceAll("_", " ");
      const html = await readFile(join(dir, "page.html"), "utf8");
      const batches = JSON.parse(
        await readFile(join(dir, "redirects.json"), "utf8"),
      ) as RedirectsResponse[];
      const back = await recordLinksBack(lang, title, html, batches);
      await writeJson(join(dir, "linksback.json"), back);
      console.log(`${lang}:${title}  ${back.back.length}/${back.checked.length} link back`);
    }
  }
}

async function main() {
  const all = process.argv.slice(2);
  if (all[0] === "--linksback-only") return relinkAll();
  if (all[0] === "--languages") return recordLanguages();
  const fallback = all.includes("--fallback");
  const [first, second, ...rest] = all.filter((a) => a !== "--fallback");
  const jobs: [string, string][] =
    first === "--starter"
      ? Object.entries(STARTER).flatMap(([lang, titles]) =>
          titles.map((t): [string, string] => [lang, t]),
        )
      : first && second && rest.length === 0
        ? [[first, second]]
        : [];
  if (jobs.length === 0) {
    console.error(
      'Usage: npm run fixtures -- <lang> "<Title>"   or   npm run fixtures -- --starter',
    );
    process.exit(1);
  }
  for (const lang of new Set(jobs.map(([lang]) => lang))) await recordSiteinfo(lang);
  // One article at a time: polite to the API, and the client limits requests anyway.
  for (const [lang, title] of jobs) await recordArticle(lang, title, fallback);
}

await main();
