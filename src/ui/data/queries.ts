/**
 * Query definitions: one place for keys and lifetimes (architecture.md §6). Query data is
 * plain JSON-like data (arrays, not Maps), so it can be persisted.
 */
import { queryOptions } from "@tanstack/react-query";
import type { Article, ArticleRef, Lang, Siteinfo, Summary, Title } from "../../core/types.ts";
import { loadArticle } from "../../sources/article.ts";
import { centerRedirects } from "../../sources/linksBack.ts";
import { resolveRedirects } from "../../sources/redirects.ts";
import { loadSiteinfo } from "../../sources/siteinfo.ts";
import { loadSummary } from "../../sources/summary.ts";
import { persisters, queryClient, WEEK } from "./cache.ts";

export const keys = {
  siteinfo: (lang: Lang) => ["siteinfo", lang] as const,
  article: (lang: Lang, title: Title) => ["article", lang, title] as const,
  redirects: (lang: Lang, title: Title) => ["redirects", lang, title] as const,
  aliases: (lang: Lang, title: Title) => ["aliases", lang, title] as const,
  linksBack: (lang: Lang, title: Title) => ["linksBack", lang, title] as const,
  summary: (lang: Lang, title: Title) => ["summary", lang, title] as const,
};

export const siteinfoQuery = (lang: Lang) =>
  queryOptions<Siteinfo>({
    queryKey: keys.siteinfo(lang),
    queryFn: () => loadSiteinfo(lang),
    staleTime: WEEK,
    gcTime: WEEK,
    persister: persisters.week.persisterFn,
  });

export const articleQuery = (ref: ArticleRef) =>
  queryOptions<Article>({
    queryKey: keys.article(ref.lang, ref.title),
    queryFn: async () => {
      const article = await loadArticle(ref, {
        domParser: new DOMParser(),
        getSiteinfo: (lang) => queryClient.fetchQuery(siteinfoQuery(lang)),
      });
      // A redirect title resolves to the real article: cache it under that title too.
      if (article.ref.title !== ref.title) {
        queryClient.setQueryData(keys.article(ref.lang, article.ref.title), article);
      }
      return article;
    },
    persister: persisters.day.persisterFn,
  });

/** Redirects of the link targets Parsoid flags (`redirect: true`), as [from, to] pairs. */
export const redirectsQuery = (ref: ArticleRef, targets: Title[]) =>
  queryOptions<[Title, Title][]>({
    queryKey: keys.redirects(ref.lang, ref.title),
    queryFn: async () => [...(await resolveRedirects(ref.lang, targets))],
    persister: persisters.day.persisterFn,
  });

/** The titles that redirect to an article, for the links-back check. */
export const aliasesQuery = (ref: ArticleRef) =>
  queryOptions<Title[]>({
    queryKey: keys.aliases(ref.lang, ref.title),
    queryFn: () => centerRedirects(ref.lang, ref.title),
    staleTime: WEEK,
    gcTime: WEEK,
    persister: persisters.week.persisterFn,
  });

export interface LinksBackData {
  checked: Title[];
  back: Title[];
}

/** What is known about links back to an article; grows as more leaves are checked. */
export const linksBackQuery = (ref: ArticleRef) =>
  queryOptions<LinksBackData>({
    queryKey: keys.linksBack(ref.lang, ref.title),
    queryFn: () => ({ checked: [], back: [] }),
    persister: persisters.day.persisterFn,
  });

export const summaryQuery = (lang: Lang, title: Title) =>
  queryOptions<Summary>({
    queryKey: keys.summary(lang, title),
    queryFn: () => loadSummary(lang, title),
    persister: persisters.day.persisterFn,
  });
