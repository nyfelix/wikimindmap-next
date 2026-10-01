import { useMedia } from "./useMedia.ts";

/** True when the reader asked for less motion: everything jumps to its end state. */
export function useReducedMotion(): boolean {
  return useMedia("(prefers-reduced-motion: reduce)");
}
