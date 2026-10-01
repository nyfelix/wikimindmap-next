/** Branch color for a color slot (1–6 → --b1…--b6); no slot means muted (styleguide.md §6). */
export function slotColor(slot: number | undefined): string {
  return slot ? `var(--b${slot})` : "var(--muted)";
}
