/**
 * Map geometry shared by the layouts and the renderer (styleguide.md §4–§5), in map units at
 * zoom 1. Pure: text is measured by an injected function, with an estimate as the fallback.
 */

import type {
  MapNode,
  MeasureText,
  PositionedMap,
  PositionedNode,
  TextStyle,
} from "../core/types.ts";

export type { MeasureText, TextStyle };

export const FONT_SIZE: Record<TextStyle, number> = {
  center: 24,
  group: 18,
  subgroup: 14.5,
  leaf: 14.5,
  leafBold: 14.5,
  count: 12.5,
  zone: 12,
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

/**
 * A zone label (bipolar): tracked mono capitals after the fold toggle, e.g. "LINKS HERE · 505".
 * The toggle sits at the node point; the text starts `dx` after it, on the baseline y + `dy`.
 */
export const ZONE = { dx: 8, dy: 4, tracking: 0.08 } as const;
/** A pill around a both-ways leaf: height, and padding before the symbol and after ⊕. */
export const PILL = { height: 34, pad: 10 } as const;

/** Width of a pill: padding, symbol, label, ⊕, padding. Its left end is x - half - pad. */
export function pillWidth(textWidth: number, half: number): number {
  return 2 * PILL.pad + 2 * half + LABEL_GAP + textWidth + RECENTER_GAP + 2 * RECENTER_R;
}

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
    else if (style === "zone") em += 0.6 + ZONE.tracking;
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

/** The text next to a folded group, or an empty fixed branch. */
export function foldedLabel(node: MapNode): string {
  if (node.empty) return "none linked";
  const n = node.count ?? 0;
  return `+${n} ${n === 1 ? "link" : "links"}`;
}

export function glyphHalf(node: MapNode): number {
  return node.direction === "both" ? CAPSULE_HALF : GLYPH_R;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const span = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)] as const;

/** Where the text and symbols of a node are drawn: for the viewBox and the overlap test. */
export function nodeBoxes(p: PositionedNode): Box[] {
  const { node, x, y, side } = p;
  const boxes: Box[] = [];
  const add = (a: number, b: number, top: number, bottom: number) => {
    const [x0, x1] = span(a, b);
    boxes.push({ x0, y0: top, x1, y1: bottom });
  };
  switch (node.kind) {
    case "center": {
      const half = p.textWidth / 2 + CENTER.padding;
      add(-half, half, y - CENTER.height / 2, y + CENTER.height / 2);
      break;
    }
    case "group":
    case "subgroup": {
      if (p.labelSide === "above") {
        // A zone label: toggle, text, and "+N links" or "none linked" after it.
        const box = textBox("zone");
        let end = x + side * (FOLD_R + ZONE.dx + p.textWidth);
        if (node.folded || node.empty)
          end += side * (COUNT_DX + estimateText(foldedLabel(node), "count"));
        add(x - side * FOLD_R, end, y + ZONE.dy - box.above, y + ZONE.dy + box.below);
        add(x - FOLD_R, x + FOLD_R, y - FOLD_R, y + FOLD_R);
        break;
      }
      const style = p.depth === 1 ? "group" : "subgroup";
      const box = textBox(style);
      const end = x - side * GROUP_LABEL.dx;
      add(
        end,
        end - side * p.textWidth,
        y - GROUP_LABEL.dy - box.above,
        y - GROUP_LABEL.dy + box.below,
      );
      add(x - FOLD_R, x + FOLD_R, y - FOLD_R, y + FOLD_R);
      if (node.folded || node.empty) {
        const count = textBox("count");
        const start = x + side * COUNT_DX;
        const width = estimateText(foldedLabel(node), "count");
        add(start, start + side * width, y - count.above + 4.5, y + count.below + 4.5);
      }
      break;
    }
    case "leaf": {
      const box = textBox("leaf");
      const half = glyphHalf(node);
      if (p.pill) {
        const left = x - half - PILL.pad;
        add(left, left + pillWidth(p.textWidth, half), y - PILL.height / 2, y + PILL.height / 2);
        break;
      }
      let end = x + side * (half + LABEL_GAP + p.textWidth);
      if (!node.redLink) end += side * (RECENTER_GAP + RECENTER_R);
      add(x - side * half, end, y + 5 - box.above, y + 5 + box.below);
      break;
    }
    case "more": {
      const box = textBox("count");
      add(x + side * 2, x + side * (2 + p.textWidth), y + 4.5 - box.above, y + 4.5 + box.below);
      break;
    }
  }
  return boxes;
}

export function boundsOf(nodes: PositionedNode[], centerWidth: number): PositionedMap["viewBox"] {
  let x0 = -centerWidth / 2;
  let x1 = centerWidth / 2;
  let y0 = -CENTER.height / 2;
  let y1 = CENTER.height / 2;
  for (const p of nodes) {
    for (const b of nodeBoxes(p)) {
      x0 = Math.min(x0, b.x0);
      x1 = Math.max(x1, b.x1);
      y0 = Math.min(y0, b.y0);
      y1 = Math.max(y1, b.y1);
    }
  }
  const pad = 24;
  return { x: x0 - pad, y: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad };
}
