import { Link } from "react-router";
import type { LensId } from "../../core/types.ts";
import { lenses, LENS_ORDER } from "../../lenses/index.ts";
import panel from "./Panel.module.css";
import styles from "./TopRight.module.css";

interface Props {
  lens: LensId;
  onLens: (lens: LensId) => void;
  labels: boolean;
  onLabels: () => void;
  drawer: boolean;
  onDrawer: () => void;
  outline: boolean;
  onOutline: () => void;
}

/**
 * Top right (styleguide.md §2): the lens switch, ? (label the map), i (how this map is built)
 * and ≡ (outline view). Lenses that aren't built yet show "soon" and link to the help page.
 */
export function TopRight(props: Props) {
  return (
    <div className={`${panel.panel} ${panel.topRight}`}>
      <nav className={styles.lenses} aria-label="Lens">
        {LENS_ORDER.map((l) => {
          if (l.id === props.lens) {
            return (
              <span key={l.id} className={styles.lens} aria-current="true" title={l.description}>
                {l.label}
              </span>
            );
          }
          if (lenses[l.id]) {
            return (
              <button
                key={l.id}
                type="button"
                className={styles.lens}
                title={l.description}
                onClick={() => props.onLens(l.id)}
              >
                {l.label}
              </button>
            );
          }
          return (
            <Link
              key={l.id}
              className={`${styles.lens} ${styles.soon}`}
              to={`/help/lenses#${l.id}`}
              aria-label={`${l.label}, coming soon: ${l.description}`}
              data-tip={l.description}
            >
              {l.label}
              <span className={styles.soonTag} aria-hidden="true">
                Soon
              </span>
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        className={styles.icon}
        aria-pressed={props.labels}
        aria-label="Label the map"
        title="Label the map (?)"
        onClick={props.onLabels}
      >
        ?
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-pressed={props.drawer}
        aria-label="How this map is built"
        title="How this map is built (i)"
        onClick={props.onDrawer}
      >
        i
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-pressed={props.outline}
        aria-label="Outline view"
        title="Outline view (o)"
        onClick={props.onOutline}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M2 4h12M5 8h9M5 12h9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
