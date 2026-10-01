/**
 * Arrow keys on the map (US-11): along branches (away from or toward the center) and between
 * siblings. Pure, on a minimal description of the nodes, so it works for every layout.
 */
import type { MapNode, PositionedNode } from "../../core/types.ts";

export type Arrow = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export interface NavNode {
  id: string;
  kind: MapNode["kind"];
  parent?: string;
  /** 1 on the right half of the map, -1 on the left. */
  side: number;
  /** Vertical position, for the order of siblings. */
  y: number;
}

export const navNode = (p: PositionedNode): NavNode => ({
  id: p.node.id,
  kind: p.node.kind,
  ...(p.node.parent ? { parent: p.node.parent } : {}),
  side: p.side,
  y: p.y,
});

/** The nodes as drawn right now (not the copies fading out), read from the SVG. */
export function navNodesFrom(root: Element): NavNode[] {
  return [...root.querySelectorAll<SVGElement>('[data-id]:not([aria-hidden="true"])')].map((el) => {
    const parent = el.dataset.parent;
    return {
      id: el.dataset.id ?? "",
      kind: (el.dataset.node ?? "leaf") as MapNode["kind"],
      ...(parent ? { parent } : {}),
      side: Number(el.dataset.side ?? 1),
      y: el.getBoundingClientRect().top,
    };
  });
}

export function neighbor(nodes: readonly NavNode[], id: string, key: Arrow): string | undefined {
  const at = nodes.find((p) => p.id === id);
  if (!at) return undefined;
  const children = (of: string) =>
    nodes
      .filter((p) => (p.parent ?? "center") === of && p.id !== "center")
      .sort((a, b) => a.y - b.y);

  if (at.kind === "center") {
    // From the center: right goes to the right side, left to the left side.
    const side = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
    if (!side) return undefined;
    return children("center").filter((p) => p.side === side)[0]?.id;
  }

  const outward = (key === "ArrowRight" && at.side > 0) || (key === "ArrowLeft" && at.side < 0);
  const inward = (key === "ArrowLeft" && at.side > 0) || (key === "ArrowRight" && at.side < 0);
  if (outward) return children(at.id)[0]?.id;
  if (inward) return at.parent ?? "center";

  // Up and down: the previous or next sibling on the same side.
  const siblings = children(at.parent ?? "center").filter((p) => p.side === at.side);
  const index = siblings.findIndex((p) => p.id === id);
  return siblings[index + (key === "ArrowDown" ? 1 : -1)]?.id;
}
