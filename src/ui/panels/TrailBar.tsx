import type { Trail } from "../../core/types.ts";
import panel from "./Panel.module.css";
import styles from "./TrailBar.module.css";

interface Props {
  trail: Trail;
  onStep: (index: number) => void;
}

/** Bottom left: Mind map › Tony Buzan › Chess, with the current step highlighted (US-08). */
export function TrailBar({ trail, onStep }: Props) {
  return (
    <nav className={`${panel.panel} ${panel.bottomLeft}`} aria-label="Trail">
      <span className={panel.caps}>Trail</span>
      <ol className={styles.steps}>
        {trail.steps.map((step, i) => (
          <li key={`${i}:${step.ref.lang}:${step.ref.title}`}>
            {i > 0 && (
              <span className={styles.sep} aria-hidden="true">
                ›
              </span>
            )}
            <button
              type="button"
              className={styles.step}
              aria-current={i === trail.current ? "step" : undefined}
              disabled={i === trail.current}
              title={step.via ? `via ${step.via}` : undefined}
              onClick={() => onStep(i)}
            >
              {step.ref.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
