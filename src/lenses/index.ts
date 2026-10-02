/**
 * Lens registry (TS-09). The UI talks to lenses only through this file, so a new lens is one
 * file in src/lenses/ plus one line here.
 */
import type { Lens, LensId } from "../core/types.ts";
import { chapters } from "./chapters.ts";
import { kinds } from "./kinds.ts";

/** Lenses that are built. The others show as "soon" in the lens switch. */
export const lenses: Partial<Record<LensId, Lens>> = {
  chapters,
  kinds,
};

/** Every lens in the order of the lens switch, with a one-line description for "soon" ones. */
export const LENS_ORDER: { id: LensId; label: string; description: string }[] = [
  { id: "chapters", label: "Chapters", description: "The article's chapters as branches." },
  { id: "kinds", label: "Kinds", description: "People, places, works… as fixed branches." },
  { id: "links", label: "Links", description: "Where a topic comes from and where it leads." },
  { id: "metro", label: "Metro", description: "The ideas that run through the whole article." },
];

export const DEFAULT_LENS: LensId = "chapters";

export function isLensId(value: string | null | undefined): value is LensId {
  return LENS_ORDER.some((l) => l.id === value);
}

/** The lens for an ID, or the default lens when that one isn't built yet. */
export function getLens(id: LensId | string | null | undefined): Lens {
  const lens = isLensId(id) ? lenses[id] : undefined;
  return lens ?? (lenses[DEFAULT_LENS] as Lens);
}
