import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { LensOptions } from "../../core/types.ts";
import { readMapParams, toggle, writeMapParams, type MapParams } from "./mapParams.ts";

/**
 * The shareable map state, read from and written to the URL. Changes replace the history
 * entry: history is for the trail (recentering), not for every fold.
 */
export function useMapState() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readMapParams(params), [params]);

  const update = useCallback(
    (change: (options: LensOptions) => Partial<LensOptions>) => {
      setParams(
        (current) => {
          const now = readMapParams(current);
          const next: MapParams = { ...now, options: { ...now.options, ...change(now.options) } };
          return writeMapParams(current, next);
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    ...state,
    toggleFold: useCallback(
      (id: string) => update((o) => ({ folded: toggle(o.folded, id) })),
      [update],
    ),
    toggleMore: useCallback(
      (id: string) => update((o) => ({ expanded: toggle(o.expanded, id) })),
      [update],
    ),
    setDensity: useCallback((density: number) => update(() => ({ density })), [update]),
    setHousekeeping: useCallback(
      (showHousekeeping: boolean) => update(() => ({ showHousekeeping })),
      [update],
    ),
  };
}

export type MapState = ReturnType<typeof useMapState>;
