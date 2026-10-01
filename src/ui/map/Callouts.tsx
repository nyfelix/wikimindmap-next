import { useLayoutEffect, useState, type RefObject } from "react";
import type { CalloutTarget, LensExplanation } from "../../core/types.ts";
import { CALLOUT, placeCallouts, type Anchor, type PlacedCallout } from "./callouts.ts";
import styles from "./Callouts.module.css";
import panel from "../panels/Panel.module.css";

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
}

/** Map labels (US-18): dark callouts pinned to real elements of the map. */
export function Callouts({ svg, explain, version, onDone }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useLayoutEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    const root = svg.current;
    if (!root) return;
    const anchors: (Anchor & { name?: string })[] = [];
    for (const { key, selectors } of TARGETS) {
      if (!explain.callouts[key]) continue;
      for (const selector of selectors) {
        const el = [...root.querySelectorAll(selector)].find(
          (e) => !e.closest('[aria-hidden="true"]'),
        );
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const name = el.closest("[data-label]")?.getAttribute("data-label") ?? undefined;
        anchors.push({
          key,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          ...(name ? { name } : {}),
        });
        break;
      }
    }
    const placed = placeCallouts(anchors, size.w, size.h);
    // Measuring the rendered map and then placing the labels is what layout effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(
      placed.map((p) => {
        const copy = explain.callouts[p.key] ?? { title: "", text: "" };
        const name = anchors.find((a) => a.key === p.key)?.name ?? "";
        return { ...p, title: copy.title.replace("{name}", name), text: copy.text };
      }),
    );
  }, [svg, explain, version, size]);

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
            const ax = Math.max(c.left, Math.min(c.left + CALLOUT.width, c.x));
            const ay = c.y < c.top ? c.top : c.top + CALLOUT.height;
            return (
              <g key={c.key}>
                <path d={`M${c.x} ${c.y}L${ax} ${ay}`} className={styles.line} />
                <circle cx={c.x} cy={c.y} r={3.5} className={styles.dot} />
              </g>
            );
          })}
        </svg>
        {items.map((c) => (
          <div key={c.key} className={styles.callout} style={{ left: c.left, top: c.top }}>
            <b>{c.title}</b>
            <span>{c.text}</span>
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
      </div>
    </>
  );
}
