/**
 * Records real API responses into tests/fixtures/ (datamodel.md §9).
 *
 *   npm run fixtures -- en "Mind map"      one article
 *   npm run fixtures -- --starter          the whole starter set
 *
 * Writes, per article: page.html, headers.json, summary.json, redirects.json,
 * and per language: siteinfo.json. Enrichments for later milestones
 * (linksback, pageviews, wikidata, linkshere) are added by their stories.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Window } from "happy-dom";
import { API_USER_AGENT, actionUrl, createHttpClient, restUrl } from "../src/sources/http.ts";
import { titleToPath } from "../src/core/titles.ts";

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

async function recordSiteinfo(lang: string) {
  const url = actionUrl(lang, { meta: "siteinfo", siprop: "general|namespaces|namespacealiases" });
  const { data } = await http.getJson(url);
  await mkdir(join(ROOT, lang), { recursive: true });
  await writeJson(join(ROOT, lang, "siteinfo.json"), data);
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

async function recordArticle(lang: string, requested: string) {
  const page = await http.getText(restUrl(lang, `page/${titleToPath(requested)}/html`));
  // A redirect title is answered with 307 to the target; store under the real title.
  const segment = new URL(page.url).pathname.match(/\/page\/([^/]+)\/html$/)?.[1];
  const title = segment ? decodeURIComponent(segment).replaceAll("_", " ") : requested;
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
  const batches: unknown[] = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    const titles = targets.slice(i, i + BATCH).join("|");
    batches.push((await http.getJson(actionUrl(lang, { redirects: 1, titles }))).data);
  }
  await writeJson(join(dir, "redirects.json"), batches);

  console.log(
    `${lang}:${title}  ${Math.round(page.data.length / 1024)} kB, ${targets.length} redirect links`,
  );
}

async function main() {
  const [first, second, ...rest] = process.argv.slice(2);
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
  for (const [lang, title] of jobs) await recordArticle(lang, title);
}

await main();
