import { useCallback, useEffect, useRef, useState } from "react";
import type { PositionedMap } from "../../core/types.ts";
import { fitView, panBy, ZOOM, zoomAt, type View } from "./viewport.ts";

/** Elements that handle their own pointer events (nodes, toggles, ⊕) don't start a pan. */
const INTERACTIVE = "[data-interactive]";

/**
 * Pan (drag the empty canvas), zoom (wheel, pinch, + −) and fit (0, ⤢) for an SVG canvas.
 * The map is fitted again whenever `fitKey` changes (a new map), not on folds.
 */
export function useViewport(box: PositionedMap["viewBox"], fitKey: string) {
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const boxRef = useRef(box);
  useEffect(() => {
    boxRef.current = box;
  }, [box]);

  const fit = useCallback(() => {
    const el = svg.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setView(fitView(boxRef.current, width, height));
  }, []);

  // Fit every new map.
  useEffect(() => {
    fit();
  }, [fitKey, fit]);

  const zoomBy = useCallback((factor: number) => {
    const el = svg.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setView((v) => zoomAt(v, factor, width / 2, height / 2));
  }, []);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number } | undefined;

    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      // Trackpad pinch arrives as ctrl+wheel with small deltas.
      const speed = e.ctrlKey ? 0.01 : 0.0015;
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * speed), p.x, p.y));
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest(INTERACTIVE)) return;
      pointers.set(e.pointerId, local(e));
      el.setPointerCapture(e.pointerId);
      el.dataset.panning = "true";
    };
    const onMove = (e: PointerEvent) => {
      const before = pointers.get(e.pointerId);
      if (!before) return;
      const now = local(e);
      pointers.set(e.pointerId, now);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) {
          const factor = distance / pinch.distance;
          setView((v) => zoomAt(v, factor, (a.x + b.x) / 2, (a.y + b.y) / 2));
        }
        pinch = { distance };
      } else {
        setView((v) => panBy(v, now.x - before.x, now.y - before.y));
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = undefined;
      if (pointers.size === 0) delete el.dataset.panning;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Keyboard: + − zoom, 0 fit (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Only text entry keeps its keys; checkboxes and sliders don't use + − 0.
      const typing = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"])';
      if (target?.closest(`${typing}, textarea, select, [contenteditable]`)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomBy(ZOOM.step);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / ZOOM.step);
      else if (e.key === "0") fit();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fit, zoomBy]);

  return { svg, view, fit, zoomBy };
}
