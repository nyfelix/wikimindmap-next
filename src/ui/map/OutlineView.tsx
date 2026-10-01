import { useEffect, useRef } from "react";
import type { LinkDirection, MapGraph, MapNode } from "../../core/types.ts";
import { slotColor } from "./color.ts";
import { DirectionIcon } from "./DirectionGlyph.tsx";
import styles from "./OutlineView.module.css";
import panel from "../panels/Panel.module.css";

/** The direction in words for the outline (US-11). */
const DIRECTION_WORDS: Record<LinkDirection, string> = {
  out: "links out",
  both: "links both ways",
  in: "links here",
  pending: "direction not checked yet",
};

interface Props {
  graph: MapGraph;
  onCenter: (node: MapNode, element: Element) => void;
  onLeaf: (node: MapNode, element: Element) => void;
  onRecenter: (node: MapNode) => void;
  onFold: (node: MapNode) => void;
  onMore: (node: MapNode) => void;
  onClose: () => void;
}

/** The same MapGraph as nested lists, with the same actions as the map (US-11). */
export function OutlineView({
  graph,
  onCenter,
  onLeaf,
  onRecenter,
  onFold,
  onMore,
  onClose,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const children = (id: string) => graph.nodes.filter((n) => (n.parent ?? "center") === id);

  const item = (node: MapNode) => {
    if (node.kind === "leaf") {
      const title = node.target ?? node.label;
      return (
        <li key={node.id} className={styles.leaf}>
          {node.redLink ? (
            <span className={styles.missing}>{node.label}</span>
          ) : (
            <button
              type="button"
              className={styles.link}
              onClick={(e) => onLeaf(node, e.currentTarget)}
            >
              {node.label}
            </button>
          )}
          <span className={styles.dir}>
            {node.redLink ? (
              "doesn’t exist yet"
            ) : (
              <>
                <DirectionIcon
                  direction={node.direction ?? "pending"}
                  color={slotColor(node.colorSlot)}
                />
                {DIRECTION_WORDS[node.direction ?? "pending"]}
              </>
            )}
          </span>
          {!node.redLink && (
            <button
              type="button"
              className={styles.recenter}
              aria-label={`Make ${title} the center`}
              onClick={() => onRecenter(node)}
            >
              ⊕
            </button>
          )}
        </li>
      );
    }
    if (node.kind === "more") {
      return (
        <li key={node.id}>
          <button type="button" className={styles.more} onClick={() => onMore(node)}>
            {node.count ? `Show ${node.count} more links` : "Show fewer links"}
          </button>
        </li>
      );
    }
    const kids = children(node.id);
    return (
      <li key={node.id} className={styles.group}>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.fold}
            aria-expanded={!node.folded}
            aria-label={`${node.folded ? "Unfold" : "Fold"} ${node.label}`}
            onClick={() => onFold(node)}
            style={{ borderColor: slotColor(node.colorSlot) }}
          >
            {node.folded ? "+" : "−"}
          </button>
          <span className={node.kind === "group" ? styles.groupLabel : styles.subgroupLabel}>
            {node.label}
          </span>
          {node.folded && <span className={styles.count}>{node.count} links</span>}
        </div>
        {kids.length > 0 && <ul>{kids.map(item)}</ul>}
      </li>
    );
  };

  return (
    <section
      id="outline"
      className={`${panel.panel} ${styles.outline}`}
      aria-labelledby="outline-title"
    >
      <div className={styles.head}>
        <span className={panel.caps}>Outline</span>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close the outline"
        >
          ×
        </button>
      </div>
      <h2 id="outline-title" ref={heading} tabIndex={-1} className={styles.title}>
        <button
          type="button"
          className={styles.centerLink}
          onClick={(e) => onCenter(graph.center, e.currentTarget)}
        >
          {graph.center.label}
        </button>
      </h2>
      {graph.notes?.map((n) => (
        <p key={n} className={styles.note}>
          {n}
        </p>
      ))}
      <ul className={styles.tree}>{children("center").map(item)}</ul>
    </section>
  );
}
