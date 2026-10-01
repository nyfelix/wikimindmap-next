import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { redirectTargets } from "../../core/links.ts";
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
  linksBackQuery,
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
  if (graph.groups.length === 0 && !options.showHousekeeping) {
    const withSeeAlso = lens.build(article, data, { ...options, showHousekeeping: true });
    if (withSeeAlso.groups.length > 0) return { graph: withSeeAlso, autoSeeAlso: true };
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

  const enrichments = useMemo(() => {
    const data: Enrichments = { redirects };
    if (linksQ.data) {
      data.linksBack = new Set(linksQ.data.back);
      data.linksChecked = new Set(linksQ.data.checked);
    }
    return data;
  }, [redirects, linksQ.data]);

  const built = useMemo(
    () => (article && ready ? build(lens, article, enrichments, options) : undefined),
    [lens, article, ready, enrichments, options],
  );

  // Check the visible leaves that haven't been checked yet.
  const visible = useMemo(
    () =>
      [
        ...new Set(
          (built?.graph.nodes ?? []).flatMap((n) =>
            n.kind === "leaf" && n.target && !n.redLink ? [n.target] : [],
          ),
        ),
      ].sort(),
    [built],
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
        // The symbols stay "pending"; a later change of the visible leaves asks again.
      })
      .finally(() => {
        for (const t of missing) asking.current.delete(t);
      });
  }, [wantsLinks, linksQ.data, aliasesQ.data, visible, real.lang, real.title]);

  const notFound = articleQ.error instanceof HttpError && articleQ.error.kind === "NotFound";
  const failed = articleQ.isError || redirectsQ.isError;
  const status: LiveStatus = notFound ? "notFound" : failed ? "error" : built ? "ready" : "loading";
  const result: LiveMap = {
    status,
    graph: built?.graph ?? centerOnly(lens.id, real, notFound),
    autoSeeAlso: built?.autoSeeAlso ?? false,
    retry: () => {
      void articleQ.refetch();
      if (redirectsQ.isError) void redirectsQ.refetch();
    },
  };
  if (article) result.article = article;
  if (articleQ.error ?? redirectsQ.error) result.error = articleQ.error ?? redirectsQ.error;
  return result;
}
