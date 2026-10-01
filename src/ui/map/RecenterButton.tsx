import { RECENTER_R } from "../../layouts/geometry.ts";
import { activate } from "./activate.ts";
import styles from "./SvgMap.module.css";
import { useTouchHalf } from "./touch.ts";

interface Props {
  x: number;
  y: number;
  title: string;
  onRecenter: () => void;
}

/** ⊕: makes the leaf's article the new center (US-07). A separate focusable control. */
export function RecenterButton({ x, y, title, onRecenter }: Props) {
  const touch = useTouchHalf();
  return (
    <g
      className={styles.recenter}
      role="button"
      tabIndex={0}
      aria-label={`Make ${title} the center`}
      data-interactive
      {...activate(onRecenter)}
    >
      <circle className={styles.hit} cx={x} cy={y} r={touch ?? RECENTER_R + 4} />
      <circle className={styles.ring} cx={x} cy={y} r={RECENTER_R + 4} />
      <circle className={styles.recenterDisc} cx={x} cy={y} r={RECENTER_R} strokeWidth={1.2} />
      <path
        className={styles.recenterCross}
        d={`M${x} ${y - 5}v3M${x} ${y + 2}v3M${x - 5} ${y}h3M${x + 2} ${y}h3`}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}
