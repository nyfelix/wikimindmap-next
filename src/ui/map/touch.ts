import { createContext, useContext } from "react";

/**
 * On touch screens, the map zoom; 0 otherwise. Hit areas are divided by it, so tap targets stay
 * 44 × 44 px on screen at any zoom (US-10).
 */
export const TouchContext = createContext(0);

/** Half a 44 px tap target, in map units at the current zoom; undefined without touch. */
export function useTouchHalf(): number | undefined {
  const zoom = useContext(TouchContext);
  return zoom > 0 ? 22 / Math.min(zoom, 1) : undefined;
}
