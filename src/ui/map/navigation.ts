/**
 * Arrow keys on the map (US-11): along branches (away from or toward the center) and between
 * siblings. Pure, on the positioned nodes, so it works for every layout.
 */
import type { PositionedNode } from "../../core/types.ts";

export type Arrow = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export function neighbor(
  nodes: readonly PositionedNode[],
  id: string,
  key: Arrow,
): string | undefined {
  const at = nodes.find((p) => p.node.id === id);
  if (!at) return undefined;
  const children = (of: string) =>
    nodes
      .filter((p) => (p.node.parent ?? "center") === of && p.node.id !== "center")
      .sort((a, b) => a.y - b.y);

  if (at.node.kind === "center") {
    // From the center: right goes to the right side, left to the left side.
    const side = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
    if (!side) return undefined;
    const first = children("center").filter((p) => p.side === side)[0];
    return first?.node.id;
  }

  const outward = (key === "ArrowRight" && at.side > 0) || (key === "ArrowLeft" && at.side < 0);
  const inward = (key === "ArrowLeft" && at.side > 0) || (key === "ArrowRight" && at.side < 0);
  if (outward) return children(at.node.id)[0]?.node.id;
  if (inward) return at.node.parent ?? "center";

  // Up and down: the previous or next sibling on the same side.
  const siblings = children(at.node.parent ?? "center").filter((p) => p.side === at.side);
  const index = siblings.findIndex((p) => p.node.id === id);
  const next = siblings[index + (key === "ArrowDown" ? 1 : -1)];
  return next?.node.id;
}
