import { useMemo } from "react";
import type { Article, Enrichments, MapNode } from "../../core/types.ts";
import { getLayout } from "../../layouts/index.ts";
import { getLens } from "../../lenses/index.ts";
import type { MapState } from "../hooks/useMapState.ts";
import { useReducedMotion } from "../hooks/useReducedMotion.ts";
import { MapControls } from "../panels/MapControls.tsx";
import { createMeasure } from "./measure.ts";
import styles from "./MapView.module.css";
import { SvgMap, type MapActions } from "./SvgMap.tsx";
import { useFontsReady } from "./useFontsReady.ts";
import { useTween } from "./useTween.ts";
import { useViewport } from "./useViewport.ts";

/** Fold, unfold and "+N more": nodes glide to their new rows (styleguide.md §7). */
const REFLOW_MS = 250;

interface Props {
  article: Article;
  enrichments: Enrichments;
  state: MapState;
  actions?: Pick<MapActions, "onCenter" | "onLeaf" | "onRecenter">;
  isBold?: (node: MapNode) => boolean;
  /** Dims the map while a newer one is loading or after an error. */
  dimmed?: boolean;
}

/** The full-window map: lens → layout → animation → SVG, with pan, zoom and the map controls. */
export function MapView({ article, enrichments, state, actions, isBold, dimmed }: Props) {
  const lens = getLens(state.lens);
  const graph = useMemo(
    () => lens.build(article, enrichments, state.options),
    [lens, article, enrichments, state.options],
  );

  const fontsReady = useFontsReady();
  // A new measurer once the fonts are in, so widths come from the real fonts.
  const measure = useMemo(() => createMeasure(), [fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const layout = getLayout(lens.layout);
  const map = useMemo(
    () =>
      layout(
        graph,
        { width: window.innerWidth, height: window.innerHeight },
        isBold ? { measure, bold: isBold } : { measure },
      ),
    [layout, graph, measure, isBold],
  );

  const reduced = useReducedMotion();
  const frame = useTween(map, REFLOW_MS, reduced);

  // A new article, lens or See also setting is a new map: fit it to the window.
  const fitKey = `${article.ref.lang}:${article.ref.title}:${state.lens}:${state.options.showHousekeeping}:${fontsReady}`;
  const { svg, view, fit, zoomBy } = useViewport(map.viewBox, fitKey);

  return (
    <>
      <svg
        ref={svg}
        className={`${styles.canvas} ${dimmed ? styles.dimmed : ""}`}
        role="group"
        aria-label={`Mind map of ${article.displayTitle}`}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          <SvgMap
            frame={frame}
            {...actions}
            {...(isBold ? { isBold } : {})}
            onFold={(node) => state.toggleFold(node.id)}
            onMore={(node) => state.toggleMore(node.parent ?? node.id)}
          />
        </g>
      </svg>
      <MapControls
        density={state.options.density}
        onDensity={state.setDensity}
        showHousekeeping={state.options.showHousekeeping}
        onHousekeeping={state.setHousekeeping}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={fit}
      />
    </>
  );
}
