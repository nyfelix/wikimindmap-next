import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { titleToPath } from "../../core/titles.ts";
import type { Lang, MapNode } from "../../core/types.ts";
import { summaryQuery } from "../data/queries.ts";
import { DirectionIcon } from "../map/DirectionGlyph.tsx";
import { DIRECTION_TEXT } from "../map/directionText.ts";
import { slotColor } from "../map/color.ts";
import cardStyles from "./Card.module.css";
import panel from "./Panel.module.css";

interface Props {
  lang: Lang;
  node: MapNode;
  /** The element that was clicked: the card sits next to it and gets focus back on close. */
  anchor: Element;
  onClose: () => void;
  onRecenter: (node: MapNode) => void;
}

const MARGIN = 14;
const WIDTH = 300;

/** Preview of a leaf or the center (US-06): summary, chapter, direction, recenter. */
export function PreviewCard({ lang, node, anchor, onClose, onRecenter }: Props) {
  const isCenter = node.kind === "center";
  const title = node.target ?? node.label;
  const summary = useQuery({ ...summaryQuery(lang, title), enabled: !node.redLink });
  const card = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();

  // Next to the node, inside the window (styleguide.md §2).
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const r = anchor.getBoundingClientRect();
    let left = r.right + MARGIN;
    if (left + WIDTH > window.innerWidth - MARGIN) left = r.left - WIDTH - MARGIN;
    left = Math.max(MARGIN, Math.min(window.innerWidth - WIDTH - MARGIN, left));
    const top = Math.max(76, Math.min(window.innerHeight - el.offsetHeight - 76, r.top - 20));
    setPosition({ left, top });
  }, [anchor, summary.status]);

  // Focus moves into the card once it is placed (hidden elements can't take focus), and back
  // to the node when it closes.
  const placed = position !== undefined;
  useEffect(() => {
    if (placed) card.current?.focus();
  }, [placed]);
  useEffect(
    () => () => {
      if (anchor instanceof SVGElement || anchor instanceof HTMLElement) anchor.focus();
    },
    [anchor],
  );

  const chapter = node.meta?.chapter;
  const href = `https://${lang}.wikipedia.org/wiki/${titleToPath(title)}`;
  const thumb = summary.data?.thumbnail;

  return (
    <div
      ref={card}
      className={`${panel.panel} ${cardStyles.card}`}
      role="dialog"
      aria-label={`Preview: ${title}`}
      tabIndex={-1}
      style={position ? { left: position.left, top: position.top } : { visibility: "hidden" }}
    >
      <button
        type="button"
        className={cardStyles.close}
        onClick={onClose}
        aria-label="Close preview"
      >
        ×
      </button>
      <div className={`${cardStyles.head} ${thumb ? cardStyles.withThumb : ""}`}>
        <div className={cardStyles.head} style={{ padding: 0 }}>
          <span className={panel.caps}>
            {isCenter ? "Center article" : chapter ? `In ${chapter}` : "Linked article"}
          </span>
          <h3 className={cardStyles.title}>{title}</h3>
          {summary.data?.description && (
            <p className={cardStyles.description}>{summary.data.description}</p>
          )}
        </div>
        {thumb && (
          <img className={cardStyles.thumb} src={thumb.url} alt="" width={64} height={64} />
        )}
      </div>
      {!isCenter && !node.redLink && node.direction && (
        <div className={cardStyles.dir}>
          <DirectionIcon direction={node.direction} color={slotColor(node.colorSlot)} />
          {DIRECTION_TEXT[node.direction]}
        </div>
      )}
      {node.redLink ? (
        <p className={cardStyles.text}>This article doesn’t exist yet on Wikipedia.</p>
      ) : summary.isPending ? (
        <p className={`${cardStyles.text} ${cardStyles.muted}`}>Loading the summary…</p>
      ) : summary.isError ? (
        <p className={`${cardStyles.text} ${cardStyles.muted}`}>
          Wikipedia didn’t answer.{" "}
          <button
            type="button"
            className={cardStyles.button}
            onClick={() => void summary.refetch()}
          >
            Try again
          </button>
        </p>
      ) : (
        <p className={cardStyles.text}>{summary.data.extract}</p>
      )}
      <div className={cardStyles.row}>
        {!isCenter && !node.redLink && (
          <button
            type="button"
            className={`${cardStyles.button} ${cardStyles.primary}`}
            onClick={() => onRecenter(node)}
          >
            ⊕ Make it the center
          </button>
        )}
        <a className={cardStyles.button} href={href} target="_blank" rel="noopener noreferrer">
          Open on Wikipedia ↗
        </a>
      </div>
    </div>
  );
}
