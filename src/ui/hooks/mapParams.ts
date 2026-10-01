/**
 * URL query ↔ lens options (datamodel.md §8). Pure, so it can be tested without a router.
 */
import type { LensId, LensOptions } from "../../core/types.ts";
import { DEFAULT_LENS, getLens, isLensId } from "../../lenses/index.ts";

export const DENSITY = { min: 2, max: 8 } as const;

export interface MapParams {
  lens: LensId;
  options: LensOptions;
}

const list = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);

export function readMapParams(params: URLSearchParams): MapParams {
  const raw = params.get("lens");
  const lensId = isLensId(raw) ? raw : DEFAULT_LENS;
  const lens = getLens(lensId);
  const density = Number(params.get("density"));
  return {
    lens: lens.id,
    options: {
      ...lens.defaults,
      density:
        Number.isInteger(density) && density >= DENSITY.min && density <= DENSITY.max
          ? density
          : lens.defaults.density,
      showHousekeeping: params.get("hk") === "1",
      folded: list(params.get("fold")),
      expanded: list(params.get("more")),
    },
  };
}

/** Writes the options into the query, leaving defaults out so URLs stay short. */
export function writeMapParams(params: URLSearchParams, next: MapParams): URLSearchParams {
  const out = new URLSearchParams(params);
  const lens = getLens(next.lens);
  const set = (key: string, value: string | undefined) => {
    if (value) out.set(key, value);
    else out.delete(key);
  };
  set("lens", next.lens === DEFAULT_LENS ? undefined : next.lens);
  set(
    "density",
    next.options.density === lens.defaults.density ? undefined : String(next.options.density),
  );
  set("hk", next.options.showHousekeeping ? "1" : undefined);
  set("fold", next.options.folded.join(",") || undefined);
  set("more", next.options.expanded.join(",") || undefined);
  return out;
}

export function toggle(items: string[], id: string): string[] {
  return items.includes(id) ? items.filter((i) => i !== id) : [...items, id];
}
