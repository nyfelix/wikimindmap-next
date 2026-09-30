/**
 * loadArticle: Parsoid HTML first, the action=parse fallback when the HTML can't be parsed.
 */
import { titleFromPath, titleToPath } from "../core/titles.ts";
import type { Article, ArticleRef, Lang, Siteinfo } from "../core/types.ts";
import { http, restUrl, type HttpClient } from "./http.ts";
import { loadFallback, parseFallback } from "./parseFallback.ts";
import { parseParsoid, type DomParserLike } from "./parsoid.ts";
import { loadSiteinfo } from "./siteinfo.ts";

export interface LoadArticleDeps {
  client?: HttpClient;
  domParser: DomParserLike;
  getSiteinfo?: (lang: Lang, client: HttpClient) => Promise<Siteinfo>;
  /** Called when the fallback is used, with the Parsoid error. Defaults to console.warn. */
  warn?: (message: string) => void;
}

export function pageHtmlUrl(ref: ArticleRef): string {
  return restUrl(ref.lang, `page/${titleToPath(ref.title)}/html`);
}

/**
 * The real title behind a rest.php response URL: a redirect title is answered with 307 to
 * `/page/{Target}/html?redirect=no`.
 */
export function titleFromPageUrl(url: string): string | undefined {
  const segment = /\/page\/([^/]+)\/html$/.exec(new URL(url).pathname)?.[1];
  return segment ? titleFromPath(segment) : undefined;
}

export async function loadArticle(ref: ArticleRef, deps: LoadArticleDeps): Promise<Article> {
  const client = deps.client ?? http;
  const warn = deps.warn ?? console.warn;
  const [page, siteinfo] = await Promise.all([
    client.getText(pageHtmlUrl(ref)),
    (deps.getSiteinfo ?? loadSiteinfo)(ref.lang, client),
  ]);
  const real = { lang: ref.lang, title: titleFromPageUrl(page.url) ?? ref.title };
  try {
    return parseParsoid(page.data, real, siteinfo, deps.domParser, { warn });
  } catch (error) {
    warn(
      `Parsoid parsing failed for ${real.lang}:${real.title}, using the fallback: ${String(error)}`,
    );
    return parseFallback(real, await loadFallback(real, client));
  }
}
