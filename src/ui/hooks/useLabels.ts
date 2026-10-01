import { useCallback, useState } from "react";
import type { LensId } from "../../core/types.ts";

const KEY = "wikimindmap:labels-seen";

function readSeen(): LensId[] {
  try {
    const raw = localStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(value) ? (value as LensId[]) : [];
  } catch {
    return [];
  }
}

function writeSeen(seen: LensId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    // No storage: the labels show again next time, which is harmless (styleguide.md §3).
  }
}

/**
 * The map labels are shown the first time a lens is opened; `?` toggles them. Whether they
 * were seen is remembered per lens in localStorage (US-18).
 */
export function useLabels(lens: LensId) {
  const [shown, setShown] = useState<Partial<Record<LensId, boolean>>>({});
  const visible = shown[lens] ?? !readSeen().includes(lens);
  const set = useCallback(
    (on: boolean) => {
      setShown((s) => ({ ...s, [lens]: on }));
      if (!on) {
        const seen = readSeen();
        if (!seen.includes(lens)) writeSeen([...seen, lens]);
      }
    },
    [lens],
  );
  return { visible, show: () => set(true), hide: () => set(false), toggle: () => set(!visible) };
}
