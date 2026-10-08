import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { articleLinks, redirectTargets } from "../../core/links.ts";
import type {
  Article,
  ArticleRef,
  Enrichments,
  Lens,
  LensId,
  LensOptions,
  MapGraph,
} from "../../core/types.ts";
import { getLens } from "../../lenses/index.ts";
import { HttpError } from "../../sources/http.ts";
import { linksBack } from "../../sources/linksBack.ts";
import { persisters, queryClient } from "./cache.ts";
import {
  aliasesQuery,
  articleQuery,
  keys,
  kindsQuery,
  linksBackQuery,
  linksHereQuery,
  pageviewsQuery,
  redirectsQuery,
  type LinksBackData,
} from "./queries.ts";

export type LiveStatus = "loading" | "ready" | "notFound" | "error";

export interface LiveMap {
  status: LiveStatus;
  article?: Article;
  graph: MapGraph;
  error?: unknown;
  /** True when See also was switched on because the article has no other links (stubs). */
  autoSeeAlso: boolean;
  retry: () => void;
}

/** Just the center: shown at once while the article loads, and for missing articles. */
export function centerOnly(lens: LensId, ref: ArticleRef, missing = false): MapGraph {
  return {
    lens,
    center: {
      id: "center",
      kind: "center",
      label: ref.title,
      target: ref.title,
      ...(missing ? { redLink: true } : {}),
    },
    nodes: [],
    edges: [],
    groups: [],
  };
}

function build(lens: Lens, article: Article, data: Enrichments, options: LensOptions) {
  const graph = lens.build(article, data, options);
  // A stub without links in its text: show See also, if that has links (styleguide.md §15).
  if (graph.groups.every((g) => g.count === 0) && !options.showHousekeeping) {
    const withSeeAlso = lens.build(article, data, { ...options, showHousekeeping: true });
    if (withSeeAlso.groups.some((g) => g.count > 0))
      return { graph: withSeeAlso, autoSeeAlso: true };
  }
  return { graph, autoSeeAlso: false };
}

/**
 * Loads an article and the enrichments its lens needs (only those, architecture.md §3), and
 * builds the map. Links back are checked for the visible leaves only, as they appear.
 */
export function useLiveMap(ref: ArticleRef, lensId: LensId, options: LensOptions): LiveMap {
  const lens = getLens(lensId);
  const articleQ = useQuery(articleQuery(ref));
  const article = articleQ.data;
  const real = article?.ref ?? ref;

  const targets = useMemo(() => (article ? redirectTargets(article) : []), [article]);
  const redirectsQ = useQuery({ ...redirectsQuery(real, targets), enabled: article !== undefined });
  const redirects = useMemo(() => new Map(redirectsQ.data ?? []), [redirectsQ.data]);

  const wantsLinks = lens.needs.includes("linksBack");
  const ready = article !== undefined && redirectsQ.isSuccess;
  const aliasesQ = useQuery({ ...aliasesQuery(real), enabled: ready && wantsLinks });
  const linksQ = useQuery({ ...linksBackQuery(real), enabled: ready && wantsLinks });

  // Page views and kinds: only for lenses that need them (architecture.md §3), for every link
  // of the article, so the lens can group and rank them all (owner decision).
  const wantsViews = lens.needs.includes("pageviews");
  const wantsKinds = lens.needs.includes("kinds");
  const wantsHere = lens.needs.includes("linksHere");
  const allTargets = useMemo(
    () =>
      article && ready && (wantsViews || wantsKinds || wantsHere)
        ? articleLinks(
            article,
            redirects,
            (l) => !l.redLink && (l.origin === "body" || l.origin === "hatnote"),
          ).map((l) => l.target)
        : [],
    [article, ready, redirects, wantsViews, wantsKinds, wantsHere],
  );
  const viewsQ = useQuery({ ...pageviewsQuery(real, allTargets), enabled: ready && wantsViews });
  const kindsQ = useQuery({ ...kindsQuery(real, allTargets), enabled: ready && wantsKinds });
  const hereQ = useQuery({ ...linksHereQuery(real), enabled: ready && wantsHere });

  // A capped list of incoming links can't tell "both ways" from "out": the links-back check
  // covers every link out that isn't on it, before the map is built (US-15).
  const unsure = useMemo(() => {
    if (!wantsLinks || !hereQ.data?.capped) return [];
    const here = new Set(hereQ.data.titles);
    return allTargets.filter((t) => !here.has(t));
  }, [wantsLinks, hereQ.data, allTargets]);
  const [failedFor, setFailedFor] = useState<string>();
  const unsureFailed = failedFor === `${real.lang}:${real.title}`;
  const checked = useMemo(() => new Set(linksQ.data?.checked ?? []), [linksQ.data]);
  const directionsKnown = unsureFailed || unsure.every((t) => checked.has(t));

  const enriched =
    (!wantsViews || viewsQ.isSuccess) &&
    (!wantsKinds || kindsQ.isSuccess) &&
    (!wantsHere || (hereQ.isSuccess && directionsKnown));

  const enrichments = useMemo(() => {
    const data: Enrichments = { redirects };
    if (linksQ.data) {
      data.linksBack = new Set(linksQ.data.back);
      data.linksChecked = new Set(linksQ.data.checked);
    }
    if (viewsQ.data) data.pageviews = new Map(viewsQ.data);
    if (kindsQ.data) data.kinds = new Map(kindsQ.data);
    if (hereQ.data) {
      const { titles, total, capped, views } = hereQ.data;
      data.linksHere = { titles, total, capped };
      data.pageviews = new Map([...views, ...(data.pageviews ?? [])]);
    }
    return data;
  }, [redirects, linksQ.data, viewsQ.data, kindsQ.data, hereQ.data]);

  const built = useMemo(
    () => (article && ready && enriched ? build(lens, article, enrichments, options) : undefined),
    [lens, article, ready, enriched, enrichments, options],
  );

  // Check the visible leaves whose direction isn't known yet, and the unsure links out.
  const visible = useMemo(
    () =>
      [
        ...new Set([
          ...(built?.graph.nodes ?? []).flatMap((n) =>
            n.kind === "leaf" && n.target && !n.redLink && n.direction === "pending"
              ? [n.target]
              : [],
          ),
          ...unsure,
        ]),
      ].sort(),
    [built, unsure],
  );
  const asking = useRef(new Set<string>());
  useEffect(() => {
    if (!wantsLinks || !linksQ.data || !aliasesQ.data) return;
    const known = new Set([...linksQ.data.checked, ...asking.current]);
    const missing = visible.filter((t) => !known.has(t));
    if (missing.length === 0) return;
    for (const t of missing) asking.current.add(t);
    const key = keys.linksBack(real.lang, real.title);
    linksBack(real.lang, real.title, missing, { aliases: aliasesQ.data })
      .then((back) => {
        queryClient.setQueryData<LinksBackData>(key, (old) => ({
          checked: [...new Set([...(old?.checked ?? []), ...missing])],
          back: [...new Set([...(old?.back ?? []), ...back])],
        }));
        void persisters.day.persistQueryByKey(key, queryClient);
      })
      .catch(() => {
        // The symbols stay "pending"; a later change of the visible leaves asks again. The
        // Links lens then builds its map with the unsure links out as "pending".
        if (missing.some((t) => unsure.includes(t))) setFailedFor(`${real.lang}:${real.title}`);
      })
      .finally(() => {
        for (const t of missing) asking.current.delete(t);
      });
  }, [wantsLinks, linksQ.data, aliasesQ.data, visible, unsure, real.lang, real.title]);

  const notFound = articleQ.error instanceof HttpError && articleQ.error.kind === "NotFound";
  const failed =
    articleQ.isError || redirectsQ.isError || viewsQ.isError || kindsQ.isError || hereQ.isError;
  const status: LiveStatus = notFound ? "notFound" : failed ? "error" : built ? "ready" : "loading";
  const result: LiveMap = {
    status,
    graph: built?.graph ?? centerOnly(lens.id, real, notFound),
    autoSeeAlso: built?.autoSeeAlso ?? false,
    retry: () => {
      void articleQ.refetch();
      if (redirectsQ.isError) void redirectsQ.refetch();
      if (viewsQ.isError) void viewsQ.refetch();
      if (kindsQ.isError) void kindsQ.refetch();
      if (hereQ.isError) void hereQ.refetch();
    },
  };
  if (article) result.article = article;
  const error = articleQ.error ?? redirectsQ.error ?? viewsQ.error ?? kindsQ.error ?? hereQ.error;
  if (error) result.error = error;
  return result;
}
