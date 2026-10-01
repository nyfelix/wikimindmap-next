import type { LinkDirection } from "../../core/types.ts";
import { CAPSULE_HALF, GLYPH_R } from "../../layouts/geometry.ts";

interface Props {
  direction: LinkDirection;
  color: string;
  /** 1 on the right half, -1 on the left: arrows always point away from (or toward) the center. */
  side?: 1 | -1;
  x?: number;
  y?: number;
  /** A missing article: dashed ring, no arrow. */
  redLink?: boolean;
}

const ARROW = {
  strokeWidth: 1.5,
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * The direction symbol of a leaf (styleguide.md §5). Meaning is carried by shape and fill, not
 * only color: out = solid dot with an outward arrow, both = capsule with a double arrow,
 * in = ring with an inward arrow, pending = empty ring.
 */
export function DirectionGlyph({ direction, color, side = 1, x = 0, y = 0, redLink }: Props) {
  const transform = `translate(${x} ${y}) scale(${side} 1)`;
  if (redLink) {
    return (
      <circle
        transform={transform}
        r={GLYPH_R}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.5}
        strokeDasharray="2.5 2"
      />
    );
  }
  switch (direction) {
    case "both":
      return (
        <g transform={transform}>
          <rect x={-CAPSULE_HALF} y={-6} width={2 * CAPSULE_HALF} height={12} rx={6} fill={color} />
          <path
            d="M-5 0H5M-2.6 -2.6L-5 0L-2.6 2.6M2.6 -2.6L5 0L2.6 2.6"
            stroke="var(--paper)"
            {...ARROW}
          />
        </g>
      );
    case "in":
      return (
        <g transform={transform}>
          <circle r={GLYPH_R} fill="var(--paper)" stroke={color} strokeWidth={2} />
          <path d="M3 0H-3M-0.6 -2.4L-3 0L-0.6 2.4" stroke={color} {...ARROW} />
        </g>
      );
    case "pending":
      return (
        <circle
          transform={transform}
          r={GLYPH_R - 0.5}
          fill="var(--paper)"
          stroke={color}
          strokeWidth={1.5}
        />
      );
    default:
      return (
        <g transform={transform}>
          <circle r={GLYPH_R} fill={color} />
          <path d="M-3 0H3M0.6 -2.4L3 0L0.6 2.4" stroke="var(--paper)" {...ARROW} />
        </g>
      );
  }
}

/** A standalone symbol for legends, cards and the outline (HTML context). */
export function DirectionIcon({
  direction,
  color = "var(--b1)",
}: {
  direction: LinkDirection;
  color?: string;
}) {
  return (
    <svg width={22} height={16} viewBox="-11 -8 22 16" aria-hidden="true" focusable="false">
      <DirectionGlyph direction={direction} color={color} />
    </svg>
  );
}
