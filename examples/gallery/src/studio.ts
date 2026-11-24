// The export studio's settings and what it composes: an icon centered on a
// padded, shaped, colored square. One function writes both the preview and
// the download, so what you see is byte for byte what you get.
import { signal } from "nsh";
import type { IconData } from "supernsh-icons";
import { download, ink } from "./store";

export type GradDir = "r" | "br" | "b" | "tr";
export type Shape = "square" | "rounded" | "circle";
export type BgMode = "none" | "solid" | "gradient";
export type Format = "svg" | "png" | "jpeg";

/** The square every export is composed on. */
export const CANVAS_SIZE = 512;
/** The most padding leaves the icon half the canvas. */
export const PADDING_MAX = 192;
/** A corner's most: half the canvas, which makes a circle. */
export const SHAPE_MAX = CANVAS_SIZE / 2;
export const RASTER_SIZES = [256, 512, 1024, 2048];
const RASTER_MIN = 16;
const RASTER_MAX = 4096;

/** Gradient direction as userSpaceOnUse coordinates across the canvas. */
const GRADIENT_DIRS: Record<GradDir, [number, number, number, number]> = {
  r: [0, SHAPE_MAX, CANVAS_SIZE, SHAPE_MAX],
  br: [0, 0, CANVAS_SIZE, CANVAS_SIZE],
  b: [SHAPE_MAX, 0, SHAPE_MAX, CANVAS_SIZE],
  tr: [0, CANVAS_SIZE, CANVAS_SIZE, 0],
};
export const GRADIENT_LABELS: Record<GradDir, string> = { r: "→", br: "↘", b: "↓", tr: "↗" };

export const pad = signal(0);
export const shape = signal<Shape>("square");
export const cornerRadius = signal(SHAPE_MAX / 2);
export const bgMode = signal<BgMode>("none");
export const bgColor = signal("#4f46e5");
export const bgFrom = signal("#4f46e5");
export const bgTo = signal("#ec4899");
export const fillGradient = signal(false);
export const fgFrom = signal("#f59e0b");
export const fgTo = signal("#ec4899");
export const gradDir = signal<GradDir>("br");
export const pngSize = signal(512);
/** Whether the custom pixel size field is in use, and its draft. */
export const customSize = signal(false);
export const customSizeText = signal("");
export const format = signal<Format>("svg");
export const jpegQuality = signal(85);
/** JPEG has no transparency: the flat color under the canvas and its corners. */
export const jpegBg = signal("#ffffff");

/** The bitmap's pixel size: the custom field's value, held to the sane range. */
export function raster(): number {
  return Math.min(RASTER_MAX, Math.max(RASTER_MIN, Math.round(pngSize() || 512)));
}

/** A preset picked from the segmented control; `custom` shows the field instead. */
export function pickSize(id: string) {
  customSize.set(id === "custom");
  customSizeText.set("");
  if (id !== "custom") pngSize.set(Number(id));
}

/** A typed pixel size: kept while it reads as a sane one, clamped to the range. */
export function typeSize(text: string) {
  customSizeText.set(text);
  const pixels = Number.parseInt(text, 10);
  if (Number.isFinite(pixels) && pixels >= RASTER_MIN) pngSize.set(Math.min(RASTER_MAX, pixels));
}

/** The corner radius as it is set: a share of the most a square can round. */
export function radiusPercent(): string {
  return `${Math.round((cornerRadius() / SHAPE_MAX) * 100)}%`;
}

/** The download button's own summary: the format, its pixel size and quality. */
export function downloadLabel(): string {
  if (format() === "svg") return "Download SVG";
  const quality = format() === "jpeg" ? ` · ${jpegQuality()}%` : "";
  return `Download ${format().toUpperCase()} · ${raster()} px${quality}`;
}

/** What the preview canvas becomes, in the format's own terms. */
export function caption(icon: IconData): string {
  const dims = `${icon.viewBox[2]} × ${icon.viewBox[3]} glyph on a ${CANVAS_SIZE} × ${CANVAS_SIZE} canvas${icon.multicolor ? " · multicolor" : ""}`;
  if (format() === "svg") return `${dims} · saves as vector`;
  const quality = format() === "jpeg" ? ` at ${jpegQuality()}% quality` : "";
  return `${dims} · saves ${raster()} × ${raster()} px${quality}`;
}

/** The settings as one value, read fresh on every recompose. A JPEG with the
 * background off paints the flat JPEG color instead, so the preview shows
 * the file's real pixels. */
function opts(): Opts {
  const flat = format() === "jpeg" && bgMode() === "none";
  return {
    pad: pad(),
    radius: shape() === "circle" ? SHAPE_MAX : shape() === "rounded" ? cornerRadius() : 0,
    bg: flat ? "solid" : bgMode(),
    bgColor: flat ? jpegBg() : bgColor(),
    bgFrom: bgFrom(),
    bgTo: bgTo(),
    fillGradient: fillGradient(),
    fgFrom: fgFrom(),
    fgTo: fgTo(),
    dir: gradDir(),
    tint: ink(),
  };
}

interface Opts {
  pad: number;
  radius: number;
  bg: BgMode;
  bgColor: string;
  bgFrom: string;
  bgTo: string;
  fillGradient: boolean;
  fgFrom: string;
  fgTo: string;
  dir: GradDir;
  tint: string;
}

function rounded(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** The composed document: the icon centered on the padded, shaped, colored canvas. */
function markup(icon: IconData, s: Opts): string {
  const box = CANVAS_SIZE - 2 * s.pad;
  const [vx, vy, vw, vh] = icon.viewBox;
  const scale = Math.min(box / vw, box / vh);
  const tx = s.pad + (box - vw * scale) / 2 - vx * scale;
  const ty = s.pad + (box - vh * scale) / 2 - vy * scale;
  const [gx1, gy1, gx2, gy2] = GRADIENT_DIRS[s.dir];
  const gradient = (id: string, from: string, to: string) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${gx1}" y1="${gy1}" x2="${gx2}" y2="${gy2}"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
  let defs = "";
  if (s.bg === "gradient") defs += gradient("studio-bg", s.bgFrom, s.bgTo);
  if (s.radius > 0) defs += `<clipPath id="studio-clip"><rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" rx="${s.radius}"/></clipPath>`;
  const place = `transform="translate(${rounded(tx)} ${rounded(ty)}) scale(${rounded(scale)})"`;
  let iconPart: string;
  if (icon.multicolor || !s.fillGradient) {
    // The tint rides on fill and color: a body may use either, or its own fills.
    const tint = icon.multicolor ? "" : ` fill="${s.tint}" color="${s.tint}"`;
    iconPart = `<g ${place}${tint}>${icon.body}</g>`;
  } else {
    defs += gradient("studio-fill", s.fgFrom, s.fgTo);
    const mask = `<mask id="studio-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"><g ${place} fill="#fff" color="#fff">${icon.body}</g></mask>`;
    iconPart = `${mask}<rect x="${s.pad}" y="${s.pad}" width="${box}" height="${box}" fill="url(#studio-fill)" mask="url(#studio-mask)"/>`;
  }
  const bgRect = s.bg === "none" ? "" : `<rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" rx="${s.radius}" fill="${s.bg === "solid" ? s.bgColor : "url(#studio-bg)"}"/>`;
  const clip = s.radius > 0 ? ` clip-path="url(#studio-clip)"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"><defs>${defs}</defs><g${clip}>${bgRect}${iconPart}</g></svg>`;
}

/** The preview as a whole SVG document in a data URI. */
export function previewSource(icon: IconData): string {
  return `data:image/svg+xml,${encodeURIComponent(markup(icon, opts()))}`;
}

/** Runs the picked format's download from the studio's current settings. */
export function runExport(icon: IconData) {
  const base = `${icon.set}-${icon.name}`;
  const document = markup(icon, opts());
  if (format() === "svg") download(`${base}.svg`, document, "image/svg+xml");
  else if (format() === "png") download(`${base}-${raster()}.png`, document, "image/png", { size: raster() });
  else download(`${base}-${raster()}.jpg`, document, "image/jpeg", { size: raster(), quality: jpegQuality() / 100, base: jpegBg() });
}
