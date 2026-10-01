import { titleToPath } from "../../core/titles.ts";
import type { ArticleRef, LensId } from "../../core/types.ts";
import { DEFAULT_LENS } from "../../lenses/index.ts";

export function mapPath(ref: ArticleRef, lens: LensId, keep?: URLSearchParams): string {
  const params = new URLSearchParams();
  if (lens !== DEFAULT_LENS) params.set("lens", lens);
  // Recentering keeps the lens, density and See also; folds are reset (US-07).
  for (const key of ["density", "hk"]) {
    const value = keep?.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/${ref.lang}/${titleToPath(ref.title)}${query ? `?${query}` : ""}`;
}
