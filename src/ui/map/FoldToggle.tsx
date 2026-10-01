import { FOLD_R } from "../../layouts/geometry.ts";
import { activate } from "./activate.ts";
import styles from "./SvgMap.module.css";

interface Props {
  x: number;
  y: number;
  color: string;
  folded: boolean;
  label: string;
  onToggle: () => void;
}

/**
 * The shared fold toggle (US-02): a circle on the branch point with − when open and + when
 * folded. Every lens uses it for every node that has children.
 */
export function FoldToggle({ x, y, color, folded, label, onToggle }: Props) {
  return (
    <g
      className={styles.fold}
      role="button"
      tabIndex={0}
      aria-expanded={!folded}
      aria-label={`${folded ? "Unfold" : "Fold"} ${label}`}
      data-interactive
      {...activate(onToggle)}
    >
      <circle className={styles.ring} cx={x} cy={y} r={FOLD_R + 4} />
      <circle cx={x} cy={y} r={FOLD_R} fill="var(--paper)" stroke={color} strokeWidth={2} />
      <path
        d={folded ? `M${x - 3.5} ${y}h7M${x} ${y - 3.5}v7` : `M${x - 3.5} ${y}h7`}
        stroke="var(--ink)"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}
