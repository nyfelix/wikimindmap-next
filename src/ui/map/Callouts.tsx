import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { CalloutTarget, LensExplanation } from "../../core/types.ts";
import {
  labelPoint,
  placeCallouts,
  ringEdge,
  ringOf,
  type Anchor,
  type PlacedCallout,
  type Rect,
  type Ring,
} from "./callouts.ts";
import styles from "./Callouts.module.css";
import panel from "../panels/Panel.module.css";
import { DirectionIcon } from "./DirectionGlyph.tsx";

/** The three link directions: the "Link direction" label explains all of them (owner). */
const SYMBOLS = [
  ["out", "Out", "this article links there"],
  ["both", "Both ways", "that article links back too"],
  ["in", "In", "that article links here (Links in / out lens)"],
] as const;

/** The map's text, symbols and buttons: labels avoid covering them. */
const OBSTACLES =
  '[data-node] text, [data-glyph], [data-node="center"] rect, [aria-label^="Make"], [aria-expanded]';

/** A label's height from its text (220 px wide, ~34 characters per line). */
function heightOf(key: string, title: string, text: string): number {
  const lines = Math.ceil(text.length / 34) + Math.ceil(title.length / 30);
  return 22 + lines * 18 + (key === "leafDirection" ? SYMBOLS.length * 21 : 0);
}

const rectOf = (r: DOMRect): Rect => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });

interface Props {
  svg: RefObject<SVGSVGElement | null>;
  explain: LensExplanation;
  /** Changes whenever the map moves or re-renders, so the labels follow. */
  version: unknown;
  onDone: () => void;
}

/** Elements the labels point at, in the current map (first match wins). */
const TARGETS: { key: CalloutTarget; selectors: string[] }[] = [
  { key: "center", selectors: ['[data-node="center"]'] },
  {
    key: "group",
    selectors: [
      '[data-node="group"][data-side="1"] [role="button"]',
      '[data-node="group"] [role="button"]',
    ],
  },
  {
    key: "subgroup",
    selectors: ['[data-node="subgroup"][data-side="-1"] text', '[data-node="subgroup"] text'],
  },
  {
    key: "leafDirection",
    selectors: [
      '[data-node="leaf"][data-side="1"][data-direction="both"] [data-glyph]',
      '[data-node="leaf"][data-direction="both"] [data-glyph]',
      '[data-node="leaf"] [data-glyph]',
    ],
  },
  {
    key: "recenter",
    selectors: ['[data-node="leaf"][data-side="-1"] [aria-label^="Make"]', '[aria-label^="Make"]'],
  },
];

interface Item extends PlacedCallout {
  title: string;
  text: string;
  ring: Ring;
}

/** Map labels (US-18): dark callouts pinned to real elements of the map. */
export function Callouts({ svg, explain, version, onDone }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  // Real label heights, measured after the first placement; the estimate is only a start.
  const [measured, setMeasured] = useState<Partial<Record<CalloutTarget, number>>>({});
  const boxes = useRef(new Map<CalloutTarget, HTMLDivElement>());
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useLayoutEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const root = svg.current;
    if (!root) return;
    const anchors: (Anchor & { name?: string; ring: Ring })[] = [];
    const obstacles = [...root.querySelectorAll(OBSTACLES)]
      .filter((e) => !e.closest('[aria-hidden="true"]'))
      .map((e) => rectOf(e.getBoundingClientRect()));
    // Elements away from the window's edges have room around them for a label.
    const inside = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.left > 260 && r.right < size.w - 260 && r.top > 160 && r.bottom < size.h - 200;
    };
    for (const { key, selectors } of TARGETS) {
      if (!explain.callouts[key]) continue;
      const candidates = selectors.map((selector) =>
        [...root.querySelectorAll(selector)].filter((e) => !e.closest('[aria-hidden="true"]')),
      );
      // The first preferred element with room around it, else the first one at all.
      const el =
        candidates.map((list) => list.find(inside)).find((e) => e !== undefined) ??
        candidates.flat()[0];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const name = el.closest("[data-label]")?.getAttribute("data-label") ?? undefined;
      const copy = explain.callouts[key] ?? { title: "", text: "" };
      anchors.push({
        key,
        target: rectOf(r),
        height: measured[key] ?? heightOf(key, copy.title.replace("{name}", name ?? ""), copy.text),
        ring: ringOf(r.width, r.height),
        ...(name ? { name } : {}),
      });
    }
    const placed = placeCallouts(anchors, obstacles, size.w, size.h);
    // Measuring the rendered map and then placing the labels is what layout effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(
      placed.map((p) => {
        const copy = explain.callouts[p.key] ?? { title: "", text: "" };
        const anchor = anchors.find((a) => a.key === p.key);
        const name = anchor?.name ?? "";
        const ring = anchor?.ring ?? ringOf(0, 0);
        return { ...p, ring, title: copy.title.replace("{name}", name), text: copy.text };
      }),
    );
  }, [svg, explain, version, size, measured]);

  // Place again once with the measured heights, if the estimate was off.
  useLayoutEffect(() => {
    const next: Partial<Record<CalloutTarget, number>> = {};
    let changed = false;
    for (const item of items) {
      const height = boxes.current.get(item.key)?.offsetHeight;
      if (height === undefined) continue;
      next[item.key] = height;
      if (Math.abs(height - item.height) > 2) changed = true;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measuring the labels, then placing them
    if (changed) setMeasured((m) => ({ ...m, ...next }));
  }, [items]);

  return (
    <>
      <div className={`${panel.panel} ${styles.bar}`} role="status">
        <span>Labels explain the map.</span>
        <button type="button" className={styles.done} onClick={onDone}>
          Got it
        </button>
      </div>
      <div className={styles.layer} aria-hidden="true">
        <svg className={styles.lines} width={size.w} height={size.h}>
          {items.map((c) => {
            const { x: ax, y: ay } = labelPoint(c);
            // A ring around the element, so nothing covers it; the line ends at the ring.
            const edge = ringEdge(c.ring, c.x, c.y, ax, ay);
            return (
              <g key={c.key}>
                <path d={`M${edge.x} ${edge.y}L${ax} ${ay}`} className={styles.line} />
                {c.ring.shape === "circle" ? (
                  <circle cx={c.x} cy={c.y} r={c.ring.r} className={styles.ring} />
                ) : (
                  <rect
                    x={c.x - c.ring.halfWidth}
                    y={c.y - c.ring.halfHeight}
                    width={2 * c.ring.halfWidth}
                    height={2 * c.ring.halfHeight}
                    rx={c.ring.halfHeight}
                    className={styles.ring}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {items.map((c) => (
          <div
            key={c.key}
            ref={(el) => {
              if (el) boxes.current.set(c.key, el);
              else boxes.current.delete(c.key);
            }}
            className={styles.callout}
            style={{ left: c.left, top: c.top, minHeight: c.height }}
          >
            <b>{c.title}</b>
            <span>{c.text}</span>
            {c.key === "leafDirection" && (
              <span className={styles.symbols}>
                {SYMBOLS.map(([direction, name, text]) => (
                  <span key={direction} className={styles.symbol}>
                    <DirectionIcon direction={direction} />
                    <span>
                      <b>{name}:</b> {text}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* For screen readers, the labels as plain text. */}
      <div className={styles.srOnly}>
        {items.map((c) => (
          <p key={c.key}>
            {c.title}: {c.text}
          </p>
        ))}
        {SYMBOLS.map(([direction, name, text]) => (
          <p key={direction}>
            Link direction {name}: {text}
          </p>
        ))}
      </div>
    </>
  );
}
