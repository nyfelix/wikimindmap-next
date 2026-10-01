import type { KeyboardEvent, MouseEvent } from "react";

/**
 * Click and Enter/Space handlers for SVG elements acting as buttons. The action gets the
 * element, so cards can be placed next to it.
 */
export function activate(action: (element: Element) => void) {
  return {
    onClick: (e: MouseEvent<Element>) => {
      e.stopPropagation();
      action(e.currentTarget);
    },
    onKeyDown: (e: KeyboardEvent<Element>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        action(e.currentTarget);
      }
    },
  };
}
