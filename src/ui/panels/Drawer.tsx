import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { titleToPath } from "../../core/titles.ts";
import type { Article, Lens } from "../../core/types.ts";
import { DirectionIcon } from "../map/DirectionGlyph.tsx";
import cardStyles from "./Card.module.css";
import styles from "./Drawer.module.css";
import panel from "./Panel.module.css";

interface Props {
  lens: Lens;
  article?: Article;
  onClose: () => void;
  onLabels: () => void;
}

const LEGEND = [
  ["out", "Links out: this article links to it."],
  ["both", "Both ways: that article links back."],
  ["in", "Links here only: appears in the Links in / out lens."],
] as const;

/** "How this map is built" (US-18): steps, symbols, what is hidden, and the source. */
export function Drawer({ lens, article, onClose, onLabels }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const ref = article?.ref;
  return (
    <aside className={`${panel.panel} ${styles.drawer}`} aria-labelledby="drawer-title">
      <button type="button" className={cardStyles.close} onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className={panel.caps}>{lens.label} lens</span>
      <h2 id="drawer-title" className={styles.title} ref={heading} tabIndex={-1}>
        How this map is built
      </h2>
      <ol className={styles.steps}>
        {lens.explain.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className={styles.legend} aria-label="Link direction symbols">
        {LEGEND.map(([direction, text]) => (
          <div key={direction}>
            <DirectionIcon direction={direction} />
            <span>{text}</span>
          </div>
        ))}
      </div>
      <p className={styles.muted}>{lens.explain.hidden}</p>
      <div className={styles.actions}>
        <button type="button" className={cardStyles.button} onClick={onLabels}>
          Label the map
        </button>
        <Link className={styles.link} to={`/help/lenses#${lens.id}`}>
          How lenses work →
        </Link>
      </div>
      {ref && article && (
        <p className={styles.source}>
          Source:{" "}
          <a
            href={`https://${ref.lang}.wikipedia.org/w/index.php?title=${titleToPath(ref.title)}&oldid=${article.revisionId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {ref.lang}.wikipedia.org/wiki/{titleToPath(ref.title)}
          </a>{" "}
          · revision {article.revisionId}
          {article.source === "fallback" ? " · read without Parsoid" : ""}
        </p>
      )}
    </aside>
  );
}
