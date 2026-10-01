import { MARK, WORDMARK } from "./logoArt.ts";
import styles from "./Logo.module.css";

/** The mark: four organic branches around a dark center (styleguide.md §9). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK.size} ${MARK.size}`}
      aria-hidden="true"
      focusable="false"
    >
      {MARK.branches.map((b) => (
        <path key={b.color} d={b.d} fill={`var(--${b.color})`} />
      ))}
      <circle cx={MARK.center.cx} cy={MARK.center.cy} r={MARK.center.r} fill="var(--ink)" />
    </svg>
  );
}

/** Lockup: mark left of the outlined wordmark; height is the wordmark's cap height in px. */
export function Logo({ height = 20 }: { height?: number }) {
  const box = WORDMARK.box;
  const scale = height / box.height;
  return (
    <span className={styles.logo} role="img" aria-label="WikiMindMap">
      <LogoMark size={Math.round(WORDMARK.markToCaps * WORDMARK.capHeight * scale)} />
      <svg
        width={Math.round(box.width * scale)}
        height={height}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        aria-hidden="true"
        focusable="false"
      >
        <path d={WORDMARK.d} fill="var(--ink)" />
      </svg>
    </span>
  );
}
