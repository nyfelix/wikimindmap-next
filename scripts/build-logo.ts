/**
 * Draws the logo (styleguide.md §9, DS-01) and writes:
 *   src/ui/brand/logoArt.ts   mark and outlined wordmark for the app (colors from CSS tokens)
 *   public/logo.svg           lockup with light and dark colors
 *   public/favicon.svg        the mark on --paper (light) or --bg (dark)
 *
 * The wordmark is Bricolage Grotesque 800 converted to outlines, so the app never downloads
 * that font. Run with: node scripts/build-logo.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
// opentype.js 2 ships no types; only parse/charToGlyph/getKerningValue/getPath are used.
import opentype from "opentype.js";

const ROOT = join(import.meta.dirname, "..");
const FONT =
  "node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff";
const WORD = "WikiMindMap";
const SIZE = 100;
const TRACKING = -0.035;

// Light and dark values of the tokens used (src/ui/styles/tokens.css).
const LIGHT = {
  ink: "#15212b",
  paper: "#ffffff",
  b1: "#0f8f84",
  b2: "#d9860b",
  b3: "#c9406a",
  b4: "#6d4fd0",
};
const DARK = {
  ink: "#e6edf1",
  paper: "#0f161c",
  b1: "#3cc3b5",
  b2: "#f0a73a",
  b3: "#f06e95",
  b4: "#a58cff",
};

const f = (n: number) => String(Math.round(n * 100) / 100);

interface Command {
  type: "M" | "L" | "C" | "Q" | "Z";
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}
interface Glyph {
  advanceWidth: number;
  getPath(x: number, y: number, size: number): { commands: Command[] };
}
interface Font {
  unitsPerEm: number;
  tables: { os2: { sxHeight: number; sCapHeight: number } };
  charToGlyph(ch: string): Glyph;
  getKerningValue(a: Glyph, b: Glyph): number;
}

/** Outlines of the wordmark, glyph by glyph (no shaping needed for a fixed word). */
async function wordmark() {
  const buffer = await readFile(join(ROOT, FONT));
  const font = (opentype as unknown as { parse(b: ArrayBuffer): Font }).parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  const scale = SIZE / font.unitsPerEm;
  const baseline = SIZE;
  let x = 0;
  let previous: Glyph | undefined;
  let d = "";
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const ch of WORD) {
    const glyph = font.charToGlyph(ch);
    if (previous) x += font.getKerningValue(previous, glyph) * scale;
    // opentype.js 2.0 returns NaN for composite glyphs (the "i") drawn at an x offset, so each
    // glyph is drawn at 0 and shifted here.
    for (const c of glyph.getPath(0, baseline, SIZE).commands) {
      const points: [number | undefined, number | undefined][] = [
        [c.x1, c.y1],
        [c.x2, c.y2],
        [c.x, c.y],
      ];
      const used = points.filter(
        (p): p is [number, number] => p[0] !== undefined && p[1] !== undefined,
      );
      d += c.type + used.map(([px, py]) => `${f(px + x)} ${f(py)}`).join(" ");
      for (const [px, py] of used) {
        x1 = Math.min(x1, px + x);
        x2 = Math.max(x2, px + x);
        y1 = Math.min(y1, py);
        y2 = Math.max(y2, py);
      }
    }
    x += glyph.advanceWidth * scale + TRACKING * SIZE;
    previous = glyph;
  }
  return {
    d,
    box: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
    baseline,
    xHeight: font.tables.os2.sxHeight * scale,
  };
}

/**
 * The mark: four tapered branches clockwise from the top right in --b1…--b4, like the map's
 * first-level branches, each ending in a dot, around a dark center. Drawn on a 28 × 28 grid.
 */
function mark() {
  const c = 14;
  const taper = (sx: number, sy: number) => {
    const x0 = c + sx * 2;
    const x1 = c + sx * 10.2;
    const y1 = c + sy * 7.6;
    const mx = (x0 + x1) / 2;
    const a = 2.6;
    const b = 1.05;
    return (
      `M${f(x0)} ${f(c - a)}C${f(mx)} ${f(c - a)} ${f(mx)} ${f(y1 - b)} ${f(x1)} ${f(y1 - b)}` +
      `L${f(x1)} ${f(y1 + b)}C${f(mx)} ${f(y1 + b)} ${f(mx)} ${f(c + a)} ${f(x0)} ${f(c + a)}Z`
    );
  };
  const ends = [
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ] as const;
  return {
    size: 28,
    branches: ends.map(([sx, sy], i) => ({
      color: `b${i + 1}` as const,
      d: taper(sx, sy),
      dot: { cx: c + sx * 11.2, cy: c + sy * 7.6, r: 2.3 },
    })),
    center: { cx: c, cy: c, r: 5.4 },
  };
}

/** The mark's shapes; each is painted with the class of its token (see themeStyle). */
function markSvg(m: ReturnType<typeof mark>): string {
  return (
    m.branches
      .map(
        (b) =>
          `<path class="${b.color}" d="${b.d}"/>` +
          `<circle class="${b.color}" cx="${f(b.dot.cx)}" cy="${f(b.dot.cy)}" r="${b.dot.r}"/>`,
      )
      .join("") + `<circle class="ink" cx="${m.center.cx}" cy="${m.center.cy}" r="${m.center.r}"/>`
  );
}

const themeStyle = (keys: (keyof typeof LIGHT)[]) =>
  `<style>${keys.map((k) => `.${k}{fill:${LIGHT[k]}}`).join("")}` +
  `@media (prefers-color-scheme: dark){${keys.map((k) => `.${k}{fill:${DARK[k]}}`).join("")}}</style>`;

async function main() {
  const word = await wordmark();
  const m = mark();

  // Lockup (styleguide.md §9): mark height = 1.2 × x-height, gap = 0.3 × wordmark height,
  // the mark centred on the x-height band.
  const markHeight = 1.2 * word.xHeight;
  const gap = 0.3 * word.box.height;
  const scale = markHeight / m.size;
  const markY = word.baseline - word.xHeight / 2 - markHeight / 2;
  const top = Math.min(word.box.y, markY);
  const bottom = Math.max(word.box.y + word.box.height, markY + markHeight);
  const wordX = markHeight + gap - word.box.x;
  const width = wordX + word.box.x + word.box.width;
  const height = bottom - top;

  const lockup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${f(height)}" viewBox="0 ${f(top)} ${f(width)} ${f(height)}" role="img" aria-label="WikiMindMap">` +
    `<title>WikiMindMap</title>${themeStyle(["ink", "b1", "b2", "b3", "b4"])}` +
    `<g transform="translate(0 ${f(markY)}) scale(${f(scale)})">${markSvg(m)}</g>` +
    `<path class="ink" transform="translate(${f(wordX)} 0)" d="${word.d}"/></svg>\n`;

  const favicon =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">` +
    `${themeStyle(["paper", "ink", "b1", "b2", "b3", "b4"])}` +
    `<rect class="paper" width="28" height="28" rx="6"/>` +
    `<g transform="translate(14 14) scale(1.06) translate(-14 -14)">${markSvg(m)}</g></svg>\n`;

  const art =
    `// Generated by scripts/build-logo.ts. Do not edit by hand.\n\n` +
    `/** The mark on a ${m.size} × ${m.size} grid; colors are token names (--b1…--b4, --ink). */\n` +
    `export const MARK = ${JSON.stringify(m, null, 2)} as const;\n\n` +
    `/** The outlined wordmark (Bricolage Grotesque 800, ${TRACKING} em), drawn in --ink. */\n` +
    `export const WORDMARK = ${JSON.stringify(
      { d: word.d, box: word.box, baseline: word.baseline, xHeight: word.xHeight },
      (_k, v: unknown) => (typeof v === "number" ? Math.round(v * 100) / 100 : v),
      2,
    )} as const;\n`;

  await mkdir(join(ROOT, "public"), { recursive: true });
  await mkdir(join(ROOT, "src/ui/brand"), { recursive: true });
  await writeFile(join(ROOT, "public/logo.svg"), lockup);
  await writeFile(join(ROOT, "public/favicon.svg"), favicon);
  await writeFile(join(ROOT, "src/ui/brand/logoArt.ts"), art);
  console.log(`logo.svg ${Math.round(lockup.length / 1024)} kB, favicon.svg ${favicon.length} B`);
}

await main();
