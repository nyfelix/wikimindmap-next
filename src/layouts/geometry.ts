/**
 * Map geometry shared by the layouts and the renderer (styleguide.md §4–§5), in map units at
 * zoom 1. Pure: text is measured by an injected function, with an estimate as the fallback.
 */

import type { MeasureText, TextStyle } from "../core/types.ts";

export type { MeasureText, TextStyle };

export const FONT_SIZE: Record<TextStyle, number> = {
  center: 24,
  group: 18,
  subgroup: 14.5,
  leaf: 14.5,
  leafBold: 14.5,
  count: 12.5,
};

export const CENTER = { height: 54, padding: 26 };
/** Fold toggle radius. */
export const FOLD_R = 8;
/** Direction symbol: dot radius, capsule half width. */
export const GLYPH_R = 6.5;
export const CAPSULE_HALF = 9;
export const RECENTER_R = 9;
/** Space between symbol and label, and between label and ⊕. */
export const LABEL_GAP = 7;
export const RECENTER_GAP = 14;
/** Group labels sit above the branch point, ending this far before it. */
export const GROUP_LABEL = { dx: 4, dy: 12 };
export const COUNT_DX = 14;

/** Labels longer than this are shortened with "…" (the full text stays in the accessible name). */
export const MAX_CHARS = { group: 40, leaf: 52 } as const;

export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Approximate advance widths in em, close to Fira Sans and Zilla Slab.
const NARROW = new Set("iIl.,:;'|!·");
const SEMI = new Set("fjrt()[]-/ ");
const WIDE = new Set("mwMW@—");

/** A deterministic width estimate: good enough for layout without a DOM (tests, server). */
export const estimateText: MeasureText = (text, style) => {
  let em = 0;
  for (const ch of text) {
    if (NARROW.has(ch)) em += 0.27;
    else if (SEMI.has(ch)) em += 0.34;
    else if (WIDE.has(ch)) em += 0.82;
    else if (/[0-9]/.test(ch)) em += 0.56;
    else if (ch !== ch.toLowerCase()) em += 0.64;
    else em += 0.52;
  }
  const weight = style === "leafBold" ? 1.06 : style === "leaf" || style === "count" ? 1 : 0.97;
  return em * FONT_SIZE[style] * weight;
};

/** Vertical extent of a text box relative to its baseline. */
export function textBox(style: TextStyle): { above: number; below: number } {
  const size = FONT_SIZE[style];
  return { above: size * 0.78, below: size * 0.24 };
}
