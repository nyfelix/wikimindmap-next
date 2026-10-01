/**
 * Dev only: the recorded fixtures, bundled lazily by Vite. Never imported in production
 * (App.tsx loads the dev route behind import.meta.env.DEV).
 */
import type { ArticleRef } from "../../core/types.ts";
import type { RedirectsResponse } from "../../sources/redirects.ts";
import type { SiteinfoResponse } from "../../sources/siteinfo.ts";

const pages = import.meta.glob<string>("/tests/fixtures/*/*/page.html", {
  query: "?raw",
  import: "default",
});
const redirects = import.meta.glob<RedirectsResponse[]>("/tests/fixtures/*/*/redirects.json", {
  import: "default",
});
const siteinfos = import.meta.glob<SiteinfoResponse>("/tests/fixtures/*/siteinfo.json", {
  import: "default",
});

export function fixtureList(): ArticleRef[] {
  return Object.keys(pages)
    .map((path) => {
      const [, lang, dir] = /\/fixtures\/([^/]+)\/([^/]+)\/page\.html$/.exec(path) ?? [];
      return { lang: lang ?? "", title: (dir ?? "").replaceAll("_", " ") };
    })
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.title.localeCompare(b.title));
}

export async function loadFixture(ref: ArticleRef) {
  const dir = `/tests/fixtures/${ref.lang}/${ref.title.replaceAll(" ", "_")}`;
  const page = pages[`${dir}/page.html`];
  const site = siteinfos[`/tests/fixtures/${ref.lang}/siteinfo.json`];
  if (!page || !site) return undefined;
  const [html, siteinfo, redirectBatches] = await Promise.all([
    page(),
    site(),
    redirects[`${dir}/redirects.json`]?.() ?? Promise.resolve([]),
  ]);
  return { html, siteinfo, redirectBatches };
}
