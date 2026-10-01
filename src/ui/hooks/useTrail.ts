import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import type { ArticleRef, LensId, Trail } from "../../core/types.ts";
import { resolveTrail } from "./trail.ts";

const KEY = "wikimindmap:trail";

function readSaved(): unknown {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

/** History state that carries the trail, so back and forward move along it. */
export interface TrailHistoryState {
  trail: Trail;
}

/**
 * The trail lives in history.state (browser back and forward work) and is mirrored to
 * sessionStorage, so it survives a reload (datamodel.md §8).
 */
export function useTrail(ref: ArticleRef, lens: LensId): { trail: Trail; inHistory: boolean } {
  const location = useLocation();
  const fromHistory = (location.state as Partial<TrailHistoryState> | null)?.trail;
  const trail = useMemo(
    () => resolveTrail(fromHistory, readSaved(), ref, lens),
    [fromHistory, ref, lens],
  );
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(trail));
    } catch {
      // No storage (private mode): the trail still works within history.
    }
  }, [trail]);
  return { trail, inHistory: trail === fromHistory };
}
