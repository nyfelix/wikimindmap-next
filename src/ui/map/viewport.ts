/** Pan and zoom math for the full-window canvas (US-19). Pure. */
import type { PositionedMap } from "../../core/types.ts";

/** screen = map × k + (tx, ty) */
export interface View {
  k: number;
  tx: number;
  ty: number;
}

export const ZOOM = { min: 0.15, max: 3, step: 1.25, fitMax: 1.25 } as const;

/** Room the floating panels take at the window edges (styleguide.md §2). */
export const PANEL_ROOM = { top: 76, bottom: 84, side: 32 } as const;

export function fitView(box: PositionedMap["viewBox"], width: number, height: number): View {
  const availW = Math.max(100, width - 2 * PANEL_ROOM.side);
  const availH = Math.max(100, height - PANEL_ROOM.top - PANEL_ROOM.bottom);
  const k = Math.min(availW / box.width, availH / box.height, ZOOM.fitMax);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return {
    k,
    tx: width / 2 - cx * k,
    ty: PANEL_ROOM.top + availH / 2 - cy * k,
  };
}

/** Zooms by `factor` keeping the screen point (px, py) still. */
export function zoomAt(view: View, factor: number, px: number, py: number): View {
  const k = Math.min(ZOOM.max, Math.max(ZOOM.min, view.k * factor));
  const ratio = k / view.k;
  return { k, tx: px - (px - view.tx) * ratio, ty: py - (py - view.ty) * ratio };
}

export function panBy(view: View, dx: number, dy: number): View {
  return { ...view, tx: view.tx + dx, ty: view.ty + dy };
}
