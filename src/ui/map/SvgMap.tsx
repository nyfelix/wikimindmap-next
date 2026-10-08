import type { MapNode, PositionedNode } from "../../core/types.ts";
import {
  CENTER,
  COUNT_DX,
  foldedLabel,
  FOLD_R,
  glyphHalf,
  GROUP_LABEL,
  LABEL_GAP,
  PILL,
  pillWidth,
  RECENTER_GAP,
  RECENTER_R,
  ZONE,
} from "../../layouts/geometry.ts";
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

/** Edge styles drawn as a line with an arrowhead (styleguide.md §5). */
const ARROWS = new Set(["in", "out", "both"]);
const arrowId = (slot: number) => `wmm-arrow-${slot}`;

/** Draws one frame of a PositionedMap (styleguide.md §4). */
export function SvgMap({ frame, ...actions }: Props) {
  const color = new Map(frame.nodes.map((f) => [f.p.node.id, slotColor(f.p.node.colorSlot)]));
  const empty = new Set(frame.nodes.filter((f) => f.p.node.empty).map((f) => f.p.node.id));
  const slots = new Map(frame.nodes.map((f) => [f.p.node.id, f.p.node.colorSlot ?? 0]));
  // One arrowhead per group color, for the edges that show a direction (bipolar).
  const arrowSlots = [
    ...new Set(
      frame.edges
        .filter(({ e }) => ARROWS.has(e.edge.style))
        .map(({ e }) => slots.get(e.edge.to) ?? 0),
    ),
  ];
  return (
    <>
      {arrowSlots.length > 0 && (
        <defs>
          {arrowSlots.map((slot) => (
            <marker
              key={slot}
              id={arrowId(slot)}
              viewBox="0 0 10 10"
              refX={8}
              refY={5}
              markerWidth={7}
              markerHeight={7}
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10z" fill={slotColor(slot || undefined)} />
            </marker>
          ))}
        </defs>
      )}
      <g className={styles.edges}>
        {frame.edges.map(({ e, key, opacity }) => {
          const stroke = color.get(e.edge.to) ?? "var(--muted)";
          if (ARROWS.has(e.edge.style)) {
            const marker = `url(#${arrowId(slots.get(e.edge.to) ?? 0)})`;
            return (
              <path
                key={key}
                d={e.path}
                fill="none"
                stroke={stroke}
                strokeWidth={e.width}
                strokeLinecap="round"
                opacity={0.85 * opacity}
                markerEnd={marker}
                {...(e.edge.style === "both" ? { markerStart: marker } : {})}
              />
            );
          }
          if (empty.has(e.edge.to)) {
            return (
              <path
                key={key}
                d={e.path}
                fill="none"
                stroke={stroke}
                strokeWidth={e.width}
                strokeLinecap="round"
                strokeDasharray="2 9"
                opacity={0.6 * opacity}
              />
            );
          }
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
  if (p.labelSide === "above") return <ZoneView p={p} actions={actions} {...rest} />;
  const { node, x, y, side } = p;
  const color = slotColor(node.colorSlot);
  const folded = node.folded === true;
  return (
    <g
      data-node={node.kind}
      data-id={node.id}
      data-parent={node.parent}
      data-side={side}
      data-label={node.label}
      {...rest}
    >
      <text
        className={`${p.depth === 1 ? styles.group : styles.subgroup} ${node.empty ? styles.mutedLabel : ""}`}
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
      {(folded || node.empty) && (
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

/** A group as a zone label (bipolar): fold toggle, then "LINKS HERE · 505" in tracked capitals. */
function ZoneView({ p, actions, ...rest }: ViewProps) {
  const { node, x, y, side } = p;
  const textX = x + side * (FOLD_R + ZONE.dx);
  const anchor = side > 0 ? "start" : "end";
  return (
    <g
      data-node={node.kind}
      data-id={node.id}
      data-parent={node.parent}
      data-side={side}
      data-label={node.label}
      {...(node.side === "top" ? { "data-top": true } : {})}
      {...rest}
    >
      <text
        className={`${styles.zone} ${node.empty ? styles.mutedLabel : ""}`}
        x={textX}
        y={y + ZONE.dy}
        textAnchor={anchor}
      >
        {p.text}
      </text>
      {node.folded !== undefined ? (
        <FoldToggle
          x={x}
          y={y}
          color={slotColor(node.colorSlot)}
          folded={node.folded}
          label={node.label}
          onToggle={() => actions.onFold?.(node)}
        />
      ) : (
        <circle cx={x} cy={y} r={FOLD_R / 2} fill={slotColor(node.colorSlot)} opacity={0.6} />
      )}
      {(node.folded || node.empty) && (
        <text
          className={styles.count}
          x={textX + side * (p.textWidth + COUNT_DX)}
          y={y + ZONE.dy}
          textAnchor={anchor}
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
      data-parent={node.parent}
      data-side={side}
      data-direction={node.direction ?? "pending"}
      {...(p.pill ? { "data-top": true } : {})}
      {...rest}
    >
      {p.pill && (
        // The both-ways band: a pill around symbol, label and ⊕.
        <rect
          className={styles.pill}
          x={x - half - PILL.pad}
          y={y - PILL.height / 2}
          width={pillWidth(p.textWidth, half)}
          height={PILL.height}
          rx={PILL.height / 2}
          stroke={slotColor(node.colorSlot)}
        />
      )}
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
        {node.weight !== undefined && node.weight > 0 && (
          // Page views (Kinds, Links): a thin bar behind the label, as long as the label at most.
          <rect
            className={styles.weight}
            x={side > 0 ? labelX : labelX - p.textWidth * node.weight}
            y={y + 6}
            width={p.textWidth * node.weight}
            height={3}
            rx={1.5}
            fill={slotColor(node.colorSlot)}
          />
        )}
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
      data-parent={node.parent}
      data-side={side}
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
