import { useEffect, useState } from "react";
import { fontOf } from "./measure.ts";

/**
 * True once the map fonts are loaded (or after a short timeout), so text is measured in the
 * real fonts. Layouts re-run when this flips.
 */
export function useFontsReady(timeoutMs = 1500): boolean {
  const [ready, setReady] = useState(() => typeof document === "undefined" || !document.fonts);
  useEffect(() => {
    if (ready) return;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const styles = ["center", "leaf", "leafBold", "count"] as const;
    Promise.all(styles.map((s) => document.fonts.load(fontOf(s)))).then(finish, finish);
    const timer = setTimeout(finish, timeoutMs);
    return () => clearTimeout(timer);
  }, [ready, timeoutMs]);
  return ready;
}
