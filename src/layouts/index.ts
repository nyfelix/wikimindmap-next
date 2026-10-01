/** Layout registry: a lens names its layout by ID. */
import type { Layout, LayoutId } from "../core/types.ts";
import { mindmapTree } from "./mindmapTree.ts";

export const layouts: Partial<Record<LayoutId, Layout>> = { mindmapTree };

export function getLayout(id: LayoutId): Layout {
  return layouts[id] ?? mindmapTree;
}
