/**
 * Answers every Wikipedia request from tests/fixtures, so e2e tests never hit the live API
 * (CLAUDE.md). Responses are built from the recorded data in the shapes the real APIs use.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Route } from "@playwright/test";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "api-user-agent, content-type",
  "access-control-allow-methods": "GET, HEAD",
};

interface LinksBackFile {
  center: string;
  aliases: string[];
  checked: string[];
  back: string[];
}

const dirOf = (lang: string, title: string) => join(FIXTURES, lang, title.replaceAll(" ", "_"));
const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path)) as unknown;
const has = (lang: string, title: string) => existsSync(join(dirOf(lang, title), "page.html"));

function titlesOf(lang: string): string[] {
  const dir = join(FIXTURES, lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name.replaceAll("_", " "));
}

/** Redirects known from all recorded redirects.json files of a language, from → to. */
function redirectsOf(lang: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const title of titlesOf(lang)) {
    const path = join(dirOf(lang, title), "redirects.json");
    if (!existsSync(path)) continue;
    for (const batch of json(path) as {
      query?: { redirects?: { from: string; to: string }[] };
    }[]) {
      for (const r of batch.query?.redirects ?? []) map.set(r.from, r.to);
    }
  }
  return map;
}

/** Redirect titles the tests use to reach fixtures. */
const PAGE_REDIRECTS: Record<string, Record<string, string>> = {
  en: { Mindmap: "Mind map", "Mind-map": "Mind map", Zürich: "Zurich" },
};

/** Langlinks between recorded articles. */
const LANGLINKS: Record<string, Record<string, string>> = {
  "en:Mind map": { de: "Mindmap", fr: "Carte heuristique" },
  "de:Mindmap": { en: "Mind map", fr: "Carte heuristique" },
  "en:Albert Einstein": { de: "Albert Einstein" },
};

export interface MockOptions {
  /** Titles whose page request fails with a network error. */
  failing?: string[];
}

export interface MockLog {
  requests: string[];
}

export async function mockWikipedia(page: Page, options: MockOptions = {}): Promise<MockLog> {
  const log: MockLog = { requests: [] };
  await page.route(/^https:\/\/([a-z-]+\.wikipedia|meta\.wikimedia)\.org\//, (route) =>
    handle(route, log, options),
  );
  return log;
}

async function handle(route: Route, log: MockLog, options: MockOptions) {
  const request = route.request();
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  const url = new URL(request.url());
  log.requests.push(url.pathname + url.search);
  const lang = url.hostname.split(".")[0] ?? "en";
  const reply = (body: unknown, status = 200) =>
    route.fulfill({
      status,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  // Parsoid HTML
  const page = /^\/w\/rest\.php\/v1\/page\/([^/]+)\/html$/.exec(url.pathname);
  if (page) {
    const title = decodeURIComponent(page[1] ?? "").replaceAll("_", " ");
    if (options.failing?.includes(title)) return route.abort("internetdisconnected");
    const target = PAGE_REDIRECTS[lang]?.[title];
    if (target && url.searchParams.get("redirect") !== "no") {
      return route.fulfill({
        status: 307,
        headers: {
          ...CORS,
          location: `/w/rest.php/v1/page/${encodeURIComponent(target.replaceAll(" ", "_"))}/html?redirect=no`,
        },
      });
    }
    if (!has(lang, title)) {
      return reply(
        { errorKey: "rest-nonexistent-title", httpCode: 404, httpReason: "Not Found" },
        404,
      );
    }
    const headers = (
      json(join(dirOf(lang, title), "headers.json")) as { headers: Record<string, string> }
    ).headers;
    return route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": headers["content-type"] ?? "text/html" },
      body: read(join(dirOf(lang, title), "page.html")),
    });
  }

  // Search
  if (url.pathname === "/w/rest.php/v1/search/title") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const pages = titlesOf(lang)
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 8)
      .map((title) => ({ title, description: `Description of ${title}`, thumbnail: null }));
    return reply({ pages });
  }

  // Featured article feed
  if (url.pathname.startsWith("/api/rest_v1/feed/featured/")) {
    return reply({ tfa: { titles: { normalized: "Chess" } } });
  }

  if (url.pathname !== "/w/api.php") return reply({ error: "unmocked" }, 404);
  const p = url.searchParams;
  const titles = (p.get("titles") ?? "").split("|").filter(Boolean);

  if (p.get("meta") === "siteinfo") return reply(json(join(FIXTURES, lang, "siteinfo.json")));

  if (p.get("action") === "sitematrix") return reply(json(join(FIXTURES, "sitematrix.json")));

  if (p.get("prop") === "langlinks") {
    const title = titles[0] ?? "";
    const target = LANGLINKS[`${lang}:${title}`]?.[p.get("lllang") ?? ""];
    return reply({
      query: {
        pages: [
          { title, ...(target ? { langlinks: [{ lang: p.get("lllang"), title: target }] } : {}) },
        ],
      },
    });
  }

  if (p.get("list") === "random") return reply({ query: { random: [{ title: "Concept map" }] } });

  if (p.get("prop") === "redirects") {
    const center = titles[0] ?? "";
    const path = join(dirOf(lang, center), "linksback.json");
    const aliases = existsSync(path) ? (json(path) as LinksBackFile).aliases : [];
    return reply({
      query: { pages: [{ title: center, redirects: aliases.map((title) => ({ title })) }] },
    });
  }

  if (p.get("prop") === "links") {
    const center = (p.get("pltitles") ?? "").split("|")[0] ?? "";
    const path = join(dirOf(lang, center), "linksback.json");
    const back = new Set(existsSync(path) ? (json(path) as LinksBackFile).back : []);
    const redirects = redirectsOf(lang);
    const found = titles
      .filter((t) => redirects.has(t))
      .map((from) => ({ from, to: redirects.get(from) ?? from }));
    return reply({
      query: {
        redirects: found,
        pages: titles.map((t) => {
          const title = redirects.get(t) ?? t;
          return back.has(title) || back.has(t)
            ? { title, links: [{ ns: 0, title: center }] }
            : { title };
        }),
      },
    });
  }

  if (p.get("prop")?.startsWith("extracts")) {
    const title = titles[0] ?? "";
    const path = join(dirOf(lang, title), "summary.json");
    if (existsSync(path)) return reply(json(path));
    return reply({
      query: {
        pages: [{ title, description: `Description of ${title}`, extract: `Summary of ${title}.` }],
      },
    });
  }

  if (p.get("redirects") === "1" && !p.get("prop")) {
    const redirects = redirectsOf(lang);
    return reply({
      batchcomplete: true,
      query: {
        redirects: titles
          .filter((t) => redirects.has(t))
          .map((from) => ({ from, to: redirects.get(from) })),
        pages: titles.map((t) => ({ title: redirects.get(t) ?? t })),
      },
    });
  }

  return reply({ error: { code: "unmocked", info: url.search } });
}
