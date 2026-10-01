import { useEffect, useId, useRef, useState } from "react";
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
      <LensMenu lens={props.lens} onLens={props.onLens} />
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

/** On tablets (768–1023 px) the lens switch becomes a menu (US-10). */
function LensMenu({ lens, onLens }: { lens: LensId; onLens: (lens: LensId) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const current = LENS_ORDER.find((l) => l.id === lens);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={styles.menuRoot} ref={root}>
      <button
        type="button"
        className={styles.menuButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Lens: ${current?.label ?? lens}`}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul id={id} className={styles.menu} role="menu">
          {LENS_ORDER.map((l) => (
            <li key={l.id} role="none">
              {lenses[l.id] ? (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={l.id === lens}
                  onClick={() => {
                    setOpen(false);
                    if (l.id !== lens) onLens(l.id);
                  }}
                >
                  {l.label}
                  <span className={styles.menuDetail}>{l.description}</span>
                </button>
              ) : (
                <Link role="menuitem" to={`/help/lenses#${l.id}`}>
                  {l.label} <span className={styles.soonTag}>Soon</span>
                  <span className={styles.menuDetail}>{l.description}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
