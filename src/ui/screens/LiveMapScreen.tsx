import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { titleToPath } from "../../core/titles.ts";
import { mapPath } from "./paths.ts";
import type { ArticleRef, Lang, MapNode, Trail } from "../../core/types.ts";
import { langlinkQuery } from "../data/queries.ts";
import { LogoMenu } from "../brand/LogoMenu.tsx";
import { useLiveMap } from "../data/useLiveMap.ts";
import { useMapState } from "../hooks/useMapState.ts";
import { extendTrail, renameCurrent } from "../hooks/trail.ts";
import { useTrail, type TrailHistoryState } from "../hooks/useTrail.ts";
import { MapView } from "../map/MapView.tsx";
import { Attribution } from "../panels/Attribution.tsx";
import cardStyles from "../panels/Card.module.css";
import panel from "../panels/Panel.module.css";
import { PreviewCard } from "../panels/PreviewCard.tsx";
import { StateCard } from "../panels/StateCard.tsx";
import { TrailBar } from "../panels/TrailBar.tsx";
import { Drawer } from "../panels/Drawer.tsx";
import { TopRight } from "../panels/TopRight.tsx";
import { getLens } from "../../lenses/index.ts";
import { useLabels } from "../hooks/useLabels.ts";
import { SearchBox } from "../search/SearchBox.tsx";
import styles from "./LiveMapScreen.module.css";

/** "LOADING" appears only if nothing has shown up after 600 ms (styleguide.md §15). */
const LOADING_DELAY = 600;

interface Props {
  article: ArticleRef;
  /** The start page shows the map of "Mind map"; its URL stays "/" (datamodel.md §8). */
  isStart?: boolean;
}

/** A live map (US-05) with search, preview, recenter and trail (M3). */
export function LiveMapScreen({ article: asked, isStart = false }: Props) {
  const state = useMapState();
  const live = useLiveMap(asked, state.lens, state.options);
  const real = live.article?.ref ?? asked;
  const { trail, inHistory } = useTrail(real, state.lens);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const search = useRef<HTMLInputElement>(null);
  const [card, setCard] = useState<{ node: MapNode; anchor: Element }>();
  const [drawer, setDrawer] = useState(false);
  const [outline, setOutline] = useState(false);
  // After choosing a language the article isn't in, search happens there (US-09).
  const [searchLang, setSearchLang] = useState<Lang>();
  const [missingIn, setMissingIn] = useState<Lang>();
  const labels = useLabels(state.lens);
  const lens = getLens(state.lens);

  const mapKey = `${real.lang}:${real.title}:${state.lens}`;

  // A redirect title is replaced in the URL by the real title (/en/Mindmap → /en/Mind_map).
  useEffect(() => {
    if (isStart || !live.article || live.article.ref.title === asked.title) return;
    const next: TrailHistoryState = { trail: renameCurrent(trail, live.article.ref) };
    void navigate(`/${real.lang}/${titleToPath(live.article.ref.title)}${location.search}`, {
      replace: true,
      state: next,
    });
  }, [isStart, live.article, asked.title, real.lang, location.search, navigate, trail]);

  useEffect(() => {
    document.title = `${live.article?.displayTitle ?? real.title} · WikiMindMap`;
  }, [live.article, real.title]);

  // The last good map stays visible, dimmed, after an error (styleguide.md §15).
  const [lastGood, setLastGood] = useState<{ graph: typeof live.graph; key: string }>();
  if (live.status === "ready" && lastGood?.graph !== live.graph)
    setLastGood({ graph: live.graph, key: mapKey });
  const showLast = live.status === "error" && lastGood !== undefined;

  // Loading takes long: show "LOADING" under the center.
  const [slow, setSlow] = useState<string>();
  useEffect(() => {
    if (live.status !== "loading") return;
    const timer = setTimeout(() => setSlow(mapKey), LOADING_DELAY);
    return () => clearTimeout(timer);
  }, [live.status, mapKey]);

  const goTo = useCallback(
    (ref: ArticleRef, next: Trail) => {
      setCard(undefined);
      const historyState: TrailHistoryState = { trail: next };
      void navigate(mapPath(ref, state.lens, new URLSearchParams(location.search)), {
        state: historyState,
      });
    },
    [navigate, state.lens, location.search],
  );

  const recenter = useCallback(
    (node: MapNode) => {
      if (!node.target || node.redLink) return;
      const ref = { lang: real.lang, title: node.target };
      const via =
        typeof node.meta?.chapter === "string" ? node.meta.chapter.split(" › ")[0] : undefined;
      goTo(ref, extendTrail(trail, ref, state.lens, via));
    },
    [goTo, real.lang, trail, state.lens],
  );

  // Steps built in this tab are history entries: go back and forward like the browser.
  const stepTo = (index: number) => {
    const { steps, current } = trail;
    if (inHistory) void navigate(index - current);
    else {
      const step = steps[index];
      if (step) goTo(step.ref, { steps, current: index });
    }
  };

  const pick = useCallback(
    (title: string) => {
      const ref = { lang: searchLang ?? real.lang, title };
      setMissingIn(undefined);
      goTo(ref, extendTrail(trail, ref, state.lens));
    },
    [goTo, searchLang, real.lang, trail, state.lens],
  );

  // Another language: the same article there, if it exists (langlinks).
  const switchLang = (target: Lang) => {
    setMissingIn(undefined);
    void queryClient
      .fetchQuery(langlinkQuery(real.lang, real.title, target))
      .catch(() => null)
      .then((title) => {
        if (title) {
          const ref = { lang: target, title };
          goTo(ref, extendTrail(trail, ref, state.lens));
        } else {
          setSearchLang(target);
          setMissingIn(target);
          search.current?.focus();
        }
      });
  };

  // Keyboard: / focuses search, Esc closes the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable]");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        search.current?.focus();
      } else if (e.key === "Escape") {
        setCard(undefined);
        setDrawer(false);
      } else if (typing || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      } else if (e.key === "?") {
        labels.toggle();
      } else if (e.key === "i") {
        setDrawer((d) => !d);
      } else if (e.key === "o") {
        setOutline((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [labels]);

  // Leaves whose article is already cached are drawn bold (styleguide.md §4).
  const cached = useMemo(
    () =>
      new Set(
        queryClient
          .getQueryCache()
          .findAll({ queryKey: ["article", real.lang] })
          .filter((q) => q.state.status === "success")
          .map((q) => String(q.queryKey[2])),
      ),
    // Recomputed per map; a leaf loaded meanwhile turns bold on the next map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, real.lang, live.article],
  );
  const isBold = useCallback(
    (node: MapNode) => node.target !== undefined && cached.has(node.target),
    [cached],
  );

  const graph = showLast ? lastGood.graph : live.graph;
  const empty = live.status === "ready" && live.graph.groups.length === 0;

  return (
    <div className={styles.screen}>
      <MapView
        graph={graph}
        mapKey={showLast ? lastGood.key : mapKey}
        state={state}
        isBold={isBold}
        dimmed={showLast}
        onCanvasClick={() => setCard(undefined)}
        actions={{
          onLeaf: (node, anchor) => setCard({ node, anchor }),
          onCenter: (node, anchor) => {
            if (live.status === "ready") setCard({ node, anchor });
          },
          onRecenter: recenter,
        }}
        {...(live.status === "loading" && slow === mapKey ? { status: "Loading" } : {})}
        {...(labels.visible && live.status === "ready" && !empty
          ? { labels: { explain: lens.explain, onDone: labels.hide } }
          : {})}
      />

      <TopRight
        lens={state.lens}
        onLens={state.setLens}
        labels={labels.visible}
        onLabels={labels.toggle}
        drawer={drawer}
        onDrawer={() => setDrawer((d) => !d)}
        outline={outline}
        onOutline={() => setOutline((o) => !o)}
      />
      {drawer && (
        <Drawer
          lens={lens}
          {...(live.article ? { article: live.article } : {})}
          onClose={() => setDrawer(false)}
          onLabels={() => {
            setDrawer(false);
            labels.show();
          }}
        />
      )}

      <div className={`${panel.panel} ${panel.topLeft}`}>
        <LogoMenu />
        <SearchBox
          lang={searchLang ?? real.lang}
          onPick={pick}
          onLang={switchLang}
          inputRef={search}
          highlight={isStart}
          autoFocus={isStart || live.status === "notFound"}
          {...(live.status === "notFound" ? { initialQuery: asked.title } : {})}
          key={live.status === "notFound" ? `nf:${asked.title}` : "search"}
        />
      </div>

      <TrailBar trail={trail} onStep={stepTo} />
      <Attribution article={real} />

      {card && live.status === "ready" && (
        <PreviewCard
          key={card.node.id}
          lang={real.lang}
          node={card.node}
          anchor={card.anchor}
          onClose={() => setCard(undefined)}
          onRecenter={recenter}
        />
      )}

      {missingIn && (
        <StateCard eyebrow="Other language">
          <p className={cardStyles.text}>
            “{real.title}” has no article on {missingIn}.wikipedia.org. Search there instead: the
            search field above now looks in {missingIn.toUpperCase()}.
          </p>
        </StateCard>
      )}
      {live.status === "notFound" && (
        <StateCard eyebrow="Not found">
          <p className={cardStyles.text}>
            This article doesn’t exist on {real.lang}.wikipedia.org. Try the search field above.
          </p>
        </StateCard>
      )}
      {live.status === "error" && (
        <StateCard eyebrow="Network error">
          <p className={cardStyles.text}>Wikipedia didn’t answer.</p>
          <div className={cardStyles.row}>
            <button
              type="button"
              className={`${cardStyles.button} ${cardStyles.primary}`}
              onClick={live.retry}
            >
              Try again
            </button>
          </div>
        </StateCard>
      )}
      {empty && (
        <StateCard eyebrow="No links">
          <p className={cardStyles.text}>
            This article has no links to other articles in its text.
          </p>
        </StateCard>
      )}
    </div>
  );
}
