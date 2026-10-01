import type { MapNode, PositionedNode } from "../../core/types.ts";
import {
  CENTER,
  COUNT_DX,
  GROUP_LABEL,
  LABEL_GAP,
  RECENTER_GAP,
  RECENTER_R,
} from "../../layouts/geometry.ts";
import { foldedLabel, glyphHalf } from "../../layouts/mindmapTree.ts";
import { activate } from "./activate.ts";
import { slotColor } from "./color.ts";
import { DirectionGlyph } from "./DirectionGlyph.tsx";
import { FoldToggle } from "./FoldToggle.tsx";
import { RecenterButton } from "./RecenterButton.tsx";
import styles from "./SvgMap.module.css";
import type { Frame, FrameNode } from "./tween.ts";
import { useTouchHalf } from "./touch.ts";

export interface MapActions {
  onCenter?: (node: MapNode, element: Element) => void;
  onLeaf?: (node: MapNode, element: Element) => void;
  onRecenter?: (node: MapNode) => void;
  onFold?: (node: MapNode) => void;
  onMore?: (node: MapNode) => void;
  /** Leaves whose map is already cached are drawn bold. */
  isBold?: (node: MapNode) => boolean;
}

interface Props extends MapActions {
  frame: Frame;
}

/** Draws one frame of a PositionedMap (styleguide.md §4). */
export function SvgMap({ frame, ...actions }: Props) {
  const color = new Map(frame.nodes.map((f) => [f.p.node.id, slotColor(f.p.node.colorSlot)]));
  return (
    <>
      <g className={styles.edges}>
        {frame.edges.map(({ e, key, opacity }) => {
          const stroke = color.get(e.edge.to) ?? "var(--muted)";
          return e.edge.style === "twig" ? (
            <path
              key={key}
              d={e.path}
              fill="none"
              stroke={stroke}
              strokeWidth={e.width}
              strokeLinecap="round"
              opacity={0.8 * opacity}
            />
          ) : (
            <path key={key} d={e.path} fill={stroke} opacity={opacity} />
          );
        })}
      </g>
      <g>
        {frame.nodes.map((f) => (
          <NodeView key={f.leaving ? `${f.p.node.id}~` : f.p.node.id} frame={f} actions={actions} />
        ))}
      </g>
    </>
  );
}

function NodeView({ frame, actions }: { frame: FrameNode; actions: MapActions }) {
  const { p, opacity, leaving } = frame;
  const common = {
    opacity,
    ...(leaving ? { "aria-hidden": true, pointerEvents: "none" as const } : {}),
  };
  switch (p.node.kind) {
    case "center":
      return <CenterView p={p} actions={actions} {...common} />;
    case "group":
    case "subgroup":
      return <GroupView p={p} actions={actions} {...common} />;
    case "leaf":
      return <LeafView p={p} actions={actions} {...common} />;
    case "more":
      return <MoreView p={p} actions={actions} {...common} />;
  }
}

interface ViewProps {
  p: PositionedNode;
  actions: MapActions;
  opacity: number;
  pointerEvents?: "none";
}

function CenterView({ p, actions, ...rest }: ViewProps) {
  const width = p.textWidth + 2 * CENTER.padding;
  const { node } = p;
  return (
    <g
      className={styles.center}
      role="button"
      tabIndex={0}
      aria-label={`About ${node.label}`}
      data-interactive
      data-node="center"
      data-id="center"
      {...rest}
      {...activate((el) => actions.onCenter?.(node, el))}
    >
      <rect
        className={node.redLink ? styles.centerMissing : styles.centerPill}
        x={p.x - width / 2}
        y={p.y - CENTER.height / 2}
        width={width}
        height={CENTER.height}
        rx={CENTER.height / 2}
      />
      <text
        className={node.redLink ? styles.centerMissingText : styles.centerText}
        x={p.x}
        y={p.y + 8}
        textAnchor="middle"
      >
        {p.text}
      </text>
      {p.text !== node.label && <title>{node.label}</title>}
    </g>
  );
}

function GroupView({ p, actions, ...rest }: ViewProps) {
  const { node, x, y, side } = p;
  const color = slotColor(node.colorSlot);
  const folded = node.folded === true;
  return (
    <g data-node={node.kind} data-id={node.id} data-side={side} data-label={node.label} {...rest}>
      <text
        className={p.depth === 1 ? styles.group : styles.subgroup}
        x={x - side * GROUP_LABEL.dx}
        y={y - GROUP_LABEL.dy}
        textAnchor={side > 0 ? "end" : "start"}
      >
        {p.text}
        {p.text !== node.label && <title>{node.label}</title>}
      </text>
      {node.folded !== undefined && (
        <FoldToggle
          x={x}
          y={y}
          color={color}
          folded={folded}
          label={node.label}
          onToggle={() => actions.onFold?.(node)}
        />
      )}
      {folded && (
        <text
          className={styles.count}
          x={x + side * COUNT_DX}
          y={y + 4.5}
          textAnchor={side > 0 ? "start" : "end"}
        >
          {foldedLabel(node)}
        </text>
      )}
    </g>
  );
}

function LeafView({ p, actions, ...rest }: ViewProps) {
  const { node, x, y, side } = p;
  const half = glyphHalf(node);
  const labelX = x + side * (half + LABEL_GAP);
  const recenterX = labelX + side * (p.textWidth + RECENTER_GAP);
  const bold = actions.isBold?.(node) ?? false;
  const hit = useTouchHalf() ?? 11;
  const title = node.target ?? node.label;
  return (
    <g
      data-node="leaf"
      data-id={node.id}
      data-side={side}
      data-direction={node.direction ?? "pending"}
      {...rest}
    >
      <g
        className={styles.leaf}
        role="button"
        tabIndex={0}
        aria-label={`Preview ${title}`}
        data-interactive
        {...activate((el) => actions.onLeaf?.(node, el))}
      >
        <rect
          className={styles.hit}
          x={Math.min(x - side * (half + 3), labelX + side * (p.textWidth + 4))}
          y={y - hit}
          width={half + 3 + LABEL_GAP + p.textWidth + 4}
          height={2 * hit}
        />
        <rect
          className={styles.ring}
          x={Math.min(x - side * (half + 3), labelX + side * (p.textWidth + 4))}
          y={y - 11}
          width={half + 3 + LABEL_GAP + p.textWidth + 4}
          height={22}
          rx={6}
        />
        <g data-glyph>
          <DirectionGlyph
            direction={node.direction ?? "pending"}
            color={slotColor(node.colorSlot)}
            side={side}
            x={x}
            y={y}
            {...(node.redLink ? { redLink: true } : {})}
          />
        </g>
        <text
          className={`${styles.leafText} ${node.redLink ? styles.muted : ""} ${bold ? styles.bold : ""}`}
          x={labelX}
          y={y + 5}
          textAnchor={side > 0 ? "start" : "end"}
        >
          {p.text}
          {p.text !== node.label && <title>{node.label}</title>}
        </text>
      </g>
      {!node.redLink && actions.onRecenter && (
        <RecenterButton
          x={recenterX + side * RECENTER_R}
          y={y}
          title={title}
          onRecenter={() => actions.onRecenter?.(node)}
        />
      )}
    </g>
  );
}

function MoreView({ p, actions, ...rest }: ViewProps) {
  const { node, x, y, side } = p;
  const label = node.count ? `Show ${node.count} more links` : "Show fewer links";
  return (
    <g
      className={styles.more}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-interactive
      data-node="more"
      data-id={node.id}
      {...rest}
      {...activate(() => actions.onMore?.(node))}
    >
      <rect
        className={styles.ring}
        x={Math.min(x + side * 2, x + side * (2 + p.textWidth)) - 4}
        y={y - 9}
        width={p.textWidth + 8}
        height={18}
        rx={5}
      />
      <text
        className={styles.count}
        x={x + side * 2}
        y={y + 4.5}
        textAnchor={side > 0 ? "start" : "end"}
      >
        {p.text}
      </text>
    </g>
  );
}
