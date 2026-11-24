// The explorer's state: what is searched, opened and selected, and how icons
// are tinted, sized and drawn. The signals are this module's own; the
// functions and accessors below are the only way in.
import { Clipboard, announce, computed, platform, signal, token, windowSize, type WebViewRef } from "nsh";
import { type IconData, svgMarkup } from "supernsh-icons";
import { rustName, tsName } from "supernsh-icons/iconify";
import { SETS, type DemoSet } from "./demo-index";
import { LAZY } from "./data/index";
import { toast } from "./ui/toast";

/** The variant endings sets use: each becomes a filter chip, stripped to group siblings. */
const SUFFIXES = ["bold", "bulk", "duotone", "fill", "filled", "light", "line", "outline", "regular", "rounded", "sharp", "solid", "thin", "twotone"];

/** Tints one tap picks. */
const PRESETS = ["#4f46e5", "#dc2626", "#16a34a", "#f59e0b", "#0ea5e9"];
const RESULT_CAP = 3000;
/** The panes beside the stage, as wide as their `w-64` and `w-80` classes. */
const SIDEBAR_WIDTH = 256;
const DETAIL_WIDTH = 320;
/** The lists' `p-3` on both sides. */
const STAGE_PADDING = 24;

/** Where the icons are drawn: in the app's appearance, or previewed in one. */
export type Canvas = "theme" | "light" | "dark";

const query = signal("");
const pickedSet = signal<DemoSet | null>(null);
const suffix = signal<string | null>(null);
const active = signal<{ icon: IconData; meta: DemoSet } | null>(null);
const size = signal(28);
const tint = signal<string | null>(null);
const customTint = signal(PRESETS[0]);
const canvas = signal<Canvas>("theme");
const sidebarOpen = signal(false);
/** Counts each set whose bodies arrived, so lists drawn from them run again. */
const loaded = signal(0);

/** The classes of each canvas: its field, its labels, the ink that reads on it. */
const CANVAS = {
  theme: { field: "bg-background", muted: "text-muted-foreground", ink: "text-foreground", hover: "hover:bg-foreground/5" },
  light: { field: "bg-canvas-light", muted: "text-canvas-light-muted", ink: "text-canvas-light-foreground", hover: "hover:bg-canvas-light-foreground/5" },
  dark: { field: "bg-canvas-dark", muted: "text-canvas-dark-muted", ink: "text-canvas-dark-foreground", hover: "hover:bg-canvas-dark-foreground/5" },
} as const;
const PREVIEW = {
  theme: "border-border bg-card",
  light: "border-canvas-light-border bg-canvas-light",
  dark: "border-canvas-dark-border bg-canvas-dark",
} as const;
const INK: Record<Canvas, "foreground" | "canvas-light-foreground" | "canvas-dark-foreground"> = {
  theme: "foreground",
  light: "canvas-light-foreground",
  dark: "canvas-dark-foreground",
};

export const queryText = () => query();
export const currentSet = () => pickedSet();
export const activeIcon = () => active();
export const iconSize = () => size();
export const tintPicked = () => tint();
export const customColor = () => customTint();
export const canvasMode = () => canvas();
export const isSidebarOpen = () => sidebarOpen();
/** The canvas the icons are on now. */
export const surface = computed(() => CANVAS[canvas()]);
/** The card an icon is previewed on: the canvas, with an edge. */
export const previewFrame = computed(() => PREVIEW[canvas()]);
/** The color of a monotone icon: the tint picked, else one that reads on the canvas. */
export const ink = computed(() => tint() ?? token(INK[canvas()]));
export const presets = PRESETS;

/** Each set's icons, kept once loaded; `loaded` announces a new set. */
const cache = new Map<string, IconData[]>();

async function iconsOf(meta: DemoSet): Promise<IconData[]> {
  const hit = cache.get(meta.prefix);
  if (hit) return hit;
  const { BODIES } = await LAZY[meta.prefix]();
  const icons = meta.names.map((name, at) => ({ set: meta.prefix, name, body: BODIES[at][0], viewBox: BODIES[at][1], multicolor: meta.multicolor }));
  cache.set(meta.prefix, icons);
  loaded.update((n) => n + 1);
  return icons;
}

/** An icon by name in a loaded set; names are sorted, so a binary search. */
function byName(meta: DemoSet, name: string): IconData | undefined {
  const icons = cache.get(meta.prefix);
  if (!icons) return undefined;
  let low = 0;
  let high = icons.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const found = icons[mid];
    if (found.name === name) return found;
    if (found.name < name) low = mid + 1;
    else high = mid - 1;
  }
  return undefined;
}

/** `heart-fill` and `heart` share the base `heart`: they are each other's variants. */
export function baseName(name: string): string {
  let base = name;
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const ending of SUFFIXES) {
      if (base.length > ending.length + 1 && base.endsWith(`-${ending}`)) {
        base = base.slice(0, base.length - ending.length - 1);
        stripped = true;
      }
    }
  }
  return base;
}

const terms = computed(() => query().toLowerCase().split(/\s+/).filter(Boolean));
const matches = (name: string, want: string[]) => want.every((term) => name.includes(term));

export const suffixCounts = computed(() => {
  const meta = pickedSet();
  if (!meta) return [];
  return SUFFIXES.map((ending) => ({ token: ending, count: meta.names.filter((name) => name.endsWith(`-${ending}`)).length })).filter((chip) => chip.count > 0 && chip.count < meta.names.length);
});
export const tiles = computed(() => {
  void loaded();
  const meta = pickedSet();
  if (!meta) return [];
  const want = terms();
  const names = suffix() ? meta.names.filter((name) => name.endsWith(`-${suffix()}`)) : meta.names;
  const matched = want.length ? names.filter((name) => matches(name, want)) : names;
  return matched.slice(0, RESULT_CAP).map((name) => ({ meta, name, icon: byName(meta, name) }));
});
/** Four names to show for a search: those it begins first, `house` before `birdhouse`. */
function nearest(names: string[], want: string[]): string[] {
  const leads = names.filter((name) => name.startsWith(want[0])).slice(0, 4);
  return leads.length < 4 ? [...leads, ...names.filter((name) => !name.startsWith(want[0])).slice(0, 4 - leads.length)] : leads;
}
/** Global search: the sets with matches, most first, each with names to jump
 * to an icon by, until you drill into one. */
export const setHits = computed(() => {
  const want = terms();
  if (pickedSet() || !want.length) return [];
  return SETS.map((meta) => {
    const found = meta.names.filter((name) => matches(name, want));
    return { meta, count: found.length, names: nearest(found, want) };
  })
    .filter((hit) => hit.count > 0)
    .sort((a, b) => b.count - a.count);
});
export const siblings = computed(() => {
  void loaded();
  const current = active();
  if (!current) return [];
  const base = baseName(current.icon.name);
  return current.meta.names
    .filter((name) => name !== current.icon.name && baseName(name) === base)
    .map((name) => byName(current.meta, name))
    .filter((icon): icon is IconData => icon !== undefined)
    .slice(0, 12);
});
/** Whether a tile is the icon the detail pane shows, so the grid can mark it. */
export const isActive = (set: string, name: string) => active()?.icon.set === set && active()?.icon.name === name;
/** Whether the search says anything: then the home lists sets, not cards. */
export const hasQuery = () => terms().length > 0;
/** The grid stops here; a search narrows it. */
export const isCapped = () => tiles().length >= RESULT_CAP;
export const capLabel = () => `Showing the first ${RESULT_CAP.toLocaleString()}. Search to narrow.`;

/** Below this the sidebar and the detail pane are sheets over the stage. */
export const narrow = computed(() => windowSize().width < 900);
/** From here the detail pane stands beside the stage. */
export const wide = computed(() => windowSize().width >= 1200);
/** Room for a control's label beside it. */
export const roomy = computed(() => windowSize().width >= 640);
const stageWidth = computed(() => windowSize().width - (narrow() ? 0 : SIDEBAR_WIDTH) - (wide() && pickedSet() ? DETAIL_WIDTH : 0));
/** Icons to a row: as many as fit at 104 points, the room a 16-character name needs. */
export const columns = computed(() => Math.max(3, Math.floor((stageWidth() - STAGE_PADDING) / 104)));
/** Set cards to a row: as many as fit at 190 points, which holds the longest set's name. */
export const homeColumns = computed(() => Math.min(6, Math.max(2, Math.floor((stageWidth() - STAGE_PADDING) / 190))));
export const total = SETS.reduce((sum, meta) => sum + meta.names.length, 0);

export function setQuery(text: string) {
  query.set(text);
}

export function clearSearch() {
  query.set("");
  suffix.set(null);
}

export function setSuffix(ending: string | null) {
  suffix.set(ending);
}

export const suffixChosen = () => suffix();

export function setSize(points: number) {
  size.set(points);
}

export function setTint(hex: string | null) {
  tint.set(hex);
}

export function setCustomColor(hex: string) {
  customTint.set(hex);
}

export function setCanvas(mode: Canvas) {
  canvas.set(mode);
}

/** Starts a set's bodies loading without waiting for them. */
export function loadBodies(meta: DemoSet) {
  void iconsOf(meta);
}

export function openSidebar() {
  sidebarOpen.set(true);
}

export function closeSidebar() {
  sidebarOpen.set(false);
}

/** The set's grid, unfiltered, with nothing selected in it. */
export async function openSet(meta: DemoSet) {
  pickedSet.set(meta);
  suffix.set(null);
  active.set(null);
  sidebarOpen.set(false);
  await iconsOf(meta);
}

export async function openIcon(meta: DemoSet, name: string) {
  await iconsOf(meta);
  const icon = byName(meta, name);
  if (icon) active.set({ icon, meta });
}

/** A search result's name: its set opens around the icon, already selected. */
export async function jumpToIcon(meta: DemoSet, name: string) {
  await openSet(meta);
  await openIcon(meta, name);
}

export function closeDetail() {
  active.set(null);
}

export function showAllSets() {
  pickedSet.set(null);
  active.set(null);
  sidebarOpen.set(false);
}

/** The export studio of the icon the detail pane shows. */
const studioOpen = signal(false);
export const isStudioOpen = () => studioOpen();
/** The studio's one icon while it is open: an empty list unmounts the overlay. */
export const studioIcon = computed(() => {
  const current = studioOpen() ? active() : null;
  return current ? [current] : [];
});
export function openStudio() {
  if (active()) studioOpen.set(true);
}
export function closeStudio() {
  studioOpen.set(false);
}

/** The TSX an app pastes: the CLI's named export and the `<Icon>` call. */
export function tsSnippet(icon: IconData): string {
  const ident = tsName(icon.set, icon.name);
  return `import { Icon } from "supernsh-icons";\nimport { ${ident} } from "./src/icons";\n\n<Icon icon={${ident}} size={${size()}${tint() ? ` color="${tint()}"` : ""} label="${baseName(icon.name)}" />`;
}

/** The Rust an app pastes: the Cargo feature, the module's constant, the call. */
export function rustSnippet(icon: IconData): string {
  const constant = rustName(icon.set, icon.name);
  const module = icon.set.replace(/-/g, "_");
  return `// Cargo.toml: supernsh-icons = { git = "https://github.com/SuperNSH/icons", features = ["${icon.set}"] }\nuse supernsh_icons::{icon, ${module}};\n\nicon(${module}::${constant}).size(px(${size()}.0))`;
}

/** The id of the control whose copy just landed, while its label says so. */
const copied = signal<string | null>(null);
let copiedTimer: number | undefined;

/** Puts `text` on the clipboard; `id` is the control that asked. */
export function copy(id: string, text: string) {
  Clipboard.writeText(text).then(
    () => {
      copied.set(id);
      announce("Copied");
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => copied.set(null), 1600);
    },
    () => toast("Couldn’t copy. The clipboard is unavailable."),
  );
}
export const isCopied = (id: string) => copied() === id;

/** The exact copies beside the snippets: the raw SVG and the CLI's add command. */
export const exactCopies = (icon: IconData) => [
  { id: "copy-svg", label: "SVG markup", text: svgMarkup(icon) },
  { id: "copy-add", label: "add command", text: `supernsh-icons add ${icon.set}:${icon.name} --out src/icons.ts` },
];

/** The app runs in a browser: the only target where a file can be saved. */
export const isWeb = platform.os === "web";

let downloader: WebViewRef | null = null;
export function setDownloader(node: WebViewRef) {
  downloader = node;
}

/** Hands the composed file to the downloader page; a `bitmap` size turns it
 * into a raster of that pixel size, with `base` under it and a JPEG quality. */
export function download(name: string, text: string, mime: string, bitmap?: { size: number; quality?: number; base?: string }) {
  downloader?.postMessage(
    JSON.stringify({
      kind: "download",
      name,
      text,
      mime,
      width: bitmap?.size ?? 0,
      height: bitmap?.size ?? 0,
      quality: bitmap?.quality,
      base: bitmap?.base,
    }),
  );
  toast(`Saving ${name}`);
}
