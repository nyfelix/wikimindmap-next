/** The trail (US-08, datamodel.md §8): the path a reader took through the map. Pure. */
import type { ArticleRef, LensId, Trail, TrailStep } from "../../core/types.ts";

export const sameRef = (a: ArticleRef, b: ArticleRef) => a.lang === b.lang && a.title === b.title;

export function startTrail(ref: ArticleRef, lens: LensId): Trail {
  return { steps: [{ ref, lens }], current: 0 };
}

/** Recentering: the new article follows the current step; later steps are cut off. */
export function extendTrail(trail: Trail, ref: ArticleRef, lens: LensId, via?: string): Trail {
  const step: TrailStep = via ? { ref, lens, via } : { ref, lens };
  const steps = [...trail.steps.slice(0, trail.current + 1), step];
  return { steps, current: steps.length - 1 };
}

/** The current step now stands for `ref` (a redirect title replaced by the real one). */
export function renameCurrent(trail: Trail, ref: ArticleRef): Trail {
  const steps = trail.steps.map((s, i) => (i === trail.current ? { ...s, ref } : s));
  return { steps, current: trail.current };
}

/** True if `longer` has the same first `upTo + 1` steps as `shorter`. */
function startsWith(longer: Trail, shorter: Trail, upTo: number): boolean {
  if (longer.steps.length <= upTo) return false;
  for (let i = 0; i <= upTo; i++) {
    const a = longer.steps[i];
    const b = shorter.steps[i];
    if (!a || !b || !sameRef(a.ref, b.ref)) return false;
  }
  return true;
}

export function isTrail(value: unknown): value is Trail {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Partial<Trail>;
  return (
    Array.isArray(t.steps) &&
    t.steps.length > 0 &&
    typeof t.current === "number" &&
    t.current >= 0 &&
    t.current < t.steps.length &&
    t.steps.every((s) => typeof s?.ref?.lang === "string" && typeof s.ref.title === "string")
  );
}

/**
 * The trail for the article shown: the one in history.state if it ends here, else the one
 * saved for this tab if it passes here, else a new trail.
 */
export function resolveTrail(
  fromHistory: unknown,
  saved: unknown,
  ref: ArticleRef,
  lens: LensId,
): Trail {
  const currentRef = (t: Trail) => t.steps[t.current]?.ref;
  if (isTrail(fromHistory)) {
    const at = currentRef(fromHistory);
    if (at && sameRef(at, ref)) {
      // Going back: the saved trail still knows the steps ahead, so forward stays visible.
      if (isTrail(saved) && startsWith(saved, fromHistory, fromHistory.current)) {
        return { steps: saved.steps, current: fromHistory.current };
      }
      return fromHistory;
    }
  }
  if (isTrail(saved)) {
    const at = currentRef(saved);
    if (at && sameRef(at, ref)) return saved;
    const index = saved.steps.findIndex((s) => sameRef(s.ref, ref));
    if (index >= 0) return { steps: saved.steps, current: index };
  }
  return startTrail(ref, lens);
}
