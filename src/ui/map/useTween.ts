import { useEffect, useMemo, useRef, useState } from "react";
import type { PositionedMap } from "../../core/types.ts";
import { frameAt, staticFrame, type Frame } from "./tween.ts";

export interface TweenTiming {
  /** Fold, density, "+N more": the same map re-flows. */
  reflowMs: number;
  /** A new map (recentering): shared nodes move, the rest fades. */
  newMapMs: number;
  /** Changes when the map is a different one (article or lens). */
  mapKey: string;
  reduced: boolean;
}

/**
 * The frame to draw for a layout: animates from the previous layout, or jumps straight to the
 * end with reduced motion (styleguide.md §7).
 */
export function useTween(map: PositionedMap, timing: TweenTiming): Frame {
  const { reflowMs, newMapMs, mapKey, reduced } = timing;
  const still = useMemo(() => staticFrame(map), [map]);
  const [animated, setAnimated] = useState<{ map: PositionedMap; frame: Frame }>();
  const shown = useRef({ map, mapKey });

  useEffect(() => {
    const prev = shown.current;
    shown.current = { map, mapKey };
    if (prev.map === map || reduced) return;
    const duration = prev.mapKey === mapKey ? reflowMs : newMapMs;
    if (duration <= 0) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setAnimated(t < 1 ? { map, frame: frameAt(prev.map, map, t) } : undefined);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [map, mapKey, reflowMs, newMapMs, reduced]);

  // Until the first animation frame of a new layout arrives, show it as it will end.
  return animated && animated.map === map && !reduced ? animated.frame : still;
}
