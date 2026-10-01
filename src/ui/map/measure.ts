/**
 * Measures map text in the real fonts (canvas measureText), so the layout reserves exactly the
 * space a label takes. Font families come from the CSS tokens.
 */
import type { MeasureText, TextStyle } from "../../core/types.ts";
import { FONT_SIZE } from "../../layouts/geometry.ts";

const WEIGHT: Record<TextStyle, number> = {
  center: 700,
  group: 700,
  subgroup: 700,
  leaf: 400,
  leafBold: 600,
  count: 400,
};

const FAMILY_TOKEN: Record<TextStyle, string> = {
  center: "--display",
  group: "--display",
  subgroup: "--display",
  leaf: "--label",
  leafBold: "--label",
  count: "--label",
};

/** The CSS font shorthand for a map text style. */
export function fontOf(style: TextStyle, root: Element = document.documentElement): string {
  const family =
    getComputedStyle(root).getPropertyValue(FAMILY_TOKEN[style]).trim() || "sans-serif";
  return `${WEIGHT[style]} ${FONT_SIZE[style]}px ${family}`;
}

export function createMeasure(): MeasureText {
  const context = document.createElement("canvas").getContext("2d");
  const fonts = new Map<TextStyle, string>();
  const cache = new Map<string, number>();
  return (text, style) => {
    const key = `${style}\u0000${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      let font = fonts.get(style);
      if (!font) {
        font = fontOf(style);
        fonts.set(style, font);
      }
      if (context) {
        context.font = font;
        width = context.measureText(text).width;
      } else {
        width = text.length * FONT_SIZE[style] * 0.55;
      }
      cache.set(key, width);
    }
    return width;
  };
}
