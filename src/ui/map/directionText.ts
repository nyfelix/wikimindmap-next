import type { LinkDirection } from "../../core/types.ts";

/** The direction in words (US-17). */
export const DIRECTION_TEXT: Record<LinkDirection, string> = {
  out: "This article links there",
  both: "Links go both ways",
  in: "That article links here",
  pending: "Checking whether it links back…",
};
