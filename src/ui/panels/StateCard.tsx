import type { ReactNode } from "react";
import cardStyles from "./Card.module.css";
import panel from "./Panel.module.css";

/** A card in the middle of the canvas for not found, errors and empty maps (styleguide.md §15). */
export function StateCard({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className={`${panel.panel} ${cardStyles.card} ${cardStyles.centered}`} role="status">
      <span className={panel.caps}>{eyebrow}</span>
      {children}
    </div>
  );
}
