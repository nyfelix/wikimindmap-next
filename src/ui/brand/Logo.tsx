import { MARK, WORDMARK } from "./logoArt.ts";
import styles from "./Logo.module.css";

/** The mark: four tapered branches around a dark center (styleguide.md §9). */
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
        <g key={b.color} fill={`var(--${b.color})`}>
          <path d={b.d} />
          <circle cx={b.dot.cx} cy={b.dot.cy} r={b.dot.r} />
        </g>
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
      <LogoMark size={Math.round(1.2 * WORDMARK.xHeight * scale * 1.15)} />
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
