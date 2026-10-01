import { useMemo } from "react";
import type { LensExplanation, MapGraph, MapNode } from "../../core/types.ts";
import { getLayout } from "../../layouts/index.ts";
import { getLens } from "../../lenses/index.ts";
import type { MapState } from "../hooks/useMapState.ts";
import { useReducedMotion } from "../hooks/useReducedMotion.ts";
import { MapControls } from "../panels/MapControls.tsx";
import { Callouts } from "./Callouts.tsx";
import { navNodesFrom, neighbor, type Arrow } from "./navigation.ts";
import { createMeasure } from "./measure.ts";
import styles from "./MapView.module.css";
import { SvgMap, type MapActions } from "./SvgMap.tsx";
import { useFontsReady } from "./useFontsReady.ts";
import { useTween } from "./useTween.ts";
import { useViewport } from "./useViewport.ts";
import { COARSE, useMedia } from "../hooks/useMedia.ts";
import { TouchContext } from "./touch.ts";

/** styleguide.md §7: fold and "+N more" re-flow; recentering moves to a new map. */
const REFLOW_MS = 250;
const RECENTER_MS = 450;

interface Props {
  graph: MapGraph;
  /** Identifies the map (article and lens); a new key is a new map, fitted to the window. */
  mapKey: string;
  state: MapState;
  actions?: Pick<MapActions, "onCenter" | "onLeaf" | "onRecenter">;
  isBold?: (node: MapNode) => boolean;
  /** Dims the map while it isn't the current one, e.g. after an error (styleguide.md §15). */
  dimmed?: boolean;
  /** Closes cards when the empty canvas is clicked. */
  onCanvasClick?: () => void;
  /** Drawn on the map under the center, e.g. "LOADING". */
  status?: string;
  /** Map labels (US-18): shown when given. */
  labels?: { explain: LensExplanation; onDone: () => void };
}

/** The full-window map: layout → animation → SVG, with pan, zoom and the map controls. */
export function MapView({
  graph,
  mapKey,
  state,
  actions,
  isBold,
  dimmed,
  onCanvasClick,
  status,
  labels,
}: Props) {
  const lens = getLens(graph.lens);
  const fontsReady = useFontsReady();
  // A new measurer once the fonts are in, so widths come from the real fonts.
  const measure = useMemo(() => createMeasure(), [fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const layout = getLayout(lens.layout);
  // Touch screens: rows 44 px apart, so every tap target can be 44 × 44 px (US-10).
  const touch = useMedia(COARSE);
  const map = useMemo(
    () =>
      layout(
        graph,
        { width: window.innerWidth, height: window.innerHeight },
        { measure, ...(isBold ? { bold: isBold } : {}), ...(touch ? { row: 44 } : {}) },
      ),
    [layout, graph, measure, isBold, touch],
  );

  const reduced = useReducedMotion();
  const frame = useTween(map, { reflowMs: REFLOW_MS, newMapMs: RECENTER_MS, mapKey, reduced });

  // A new map or See also setting is fitted to the window (re-fitted once the fonts are in).
  const fitKey = `${mapKey}:${state.options.showHousekeeping}:${fontsReady}:${map.nodes.length > 1}`;
  const { svg, view, fit, zoomBy } = useViewport(map.viewBox, fitKey, reduced ? 0 : RECENTER_MS);

  return (
    <>
      <svg
        ref={svg}
        className={`${styles.canvas} ${dimmed ? styles.dimmed : ""}`}
        role="group"
        aria-label={`Mind map of ${graph.center.label}`}
        onClick={(e) => {
          if (!(e.target as Element).closest("[data-interactive]")) onCanvasClick?.();
        }}
        onKeyDown={(e) => {
          // Arrow keys move between nodes: along branches and between siblings (US-11).
          if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
          const from = (e.target as Element).closest("[data-id]")?.getAttribute("data-id");
          if (!from) return;
          const to = neighbor(navNodesFrom(e.currentTarget), from, e.key as Arrow);
          if (!to) return;
          e.preventDefault();
          // Not the copy that is fading out while the map re-flows.
          const target = svg.current?.querySelector(
            `[data-id="${CSS.escape(to)}"]:not([aria-hidden="true"])`,
          );
          const focusable = target?.matches('[tabindex="0"]')
            ? target
            : target?.querySelector('[tabindex="0"]');
          if (focusable instanceof SVGElement) focusable.focus();
        }}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          <TouchContext value={touch ? view.k : 0}>
            <SvgMap
              frame={frame}
              {...actions}
              {...(isBold ? { isBold } : {})}
              onFold={(node) => state.toggleFold(node.id)}
              onMore={(node) => state.toggleMore(node.parent ?? node.id)}
            />
          </TouchContext>
          {status && (
            <text className={styles.status} x={0} y={56} textAnchor="middle">
              {status}
            </text>
          )}
        </g>
      </svg>
      {labels && (
        <Callouts
          svg={svg}
          explain={labels.explain}
          version={[view, frame]}
          onDone={labels.onDone}
        />
      )}
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
