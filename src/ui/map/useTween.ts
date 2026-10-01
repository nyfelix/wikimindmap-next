import { useEffect, useMemo, useRef, useState } from "react";
import type { PositionedMap } from "../../core/types.ts";
import { frameAt, staticFrame, type Frame } from "./tween.ts";

/**
 * The frame to draw for a layout: animates from the previous layout over `duration` ms, or
 * jumps straight there with reduced motion.
 */
export function useTween(map: PositionedMap, duration: number, reduced: boolean): Frame {
  const still = useMemo(() => staticFrame(map), [map]);
  const [animated, setAnimated] = useState<{ map: PositionedMap; frame: Frame }>();
  const shown = useRef(map);

  useEffect(() => {
    const prev = shown.current;
    shown.current = map;
    if (prev === map || reduced || duration <= 0) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setAnimated(t < 1 ? { map, frame: frameAt(prev, map, t) } : undefined);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [map, duration, reduced]);

  // Until the first animation frame of a new layout arrives, show it as it will end.
  return animated && animated.map === map && !reduced ? animated.frame : still;
}
