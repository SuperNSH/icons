// The icon explorer: every bundled set's icons, searchable, with variant
// filters, sibling variants, and the snippets an app pastes. The data is
// `supernsh-icons gallery`'s: src/demo-index.ts for names, src/data/ for bodies.
import {
  Clipboard,
  colorScheme,
  computed,
  effect,
  Image,
  keymap,
  List,
  mount,
  platform,
  Scroll,
  signal,
  Text,
  View,
  WebView,
  windowSize,
  type InputRef,
  type WebViewRef,
  type JSX,
} from "nsh";
import { Button, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, Dialog, Input, Popover, Sheet, Slider, Tab } from "nsh/base";
import { Glyph, Icon, svgMarkup, type IconData } from "supernsh-icons";
import { rustName, tsName } from "supernsh-icons/iconify";
import { SETS, VERSION, type DemoSet } from "./src/demo-index";
import { LAZY } from "./src/data/index";
import { phGearFill, phHeartFill, phHouseFill, phStarFill } from "./src/icon-font";

/** The variant endings sets use: each becomes a filter chip, stripped to group siblings. */
const SUFFIXES = ["bold", "bulk", "duotone", "fill", "filled", "light", "line", "outline", "regular", "rounded", "sharp", "solid", "thin", "twotone"];

const PRESETS = ["#4f46e5", "#dc2626", "#16a34a", "#f59e0b", "#0ea5e9"];
const RESULT_CAP = 3000;

const query = signal("");
const pickedSet = signal<DemoSet | null>(null);
const suffix = signal<string | null>(null);
const active = signal<{ icon: IconData; meta: DemoSet } | null>(null);
const size = signal(28);
const color = signal<string | null>(null);
const customColor = signal(PRESETS[0]);
const pickerOpen = signal(false);
/** Preview the grid on the appearance the app is not in. */
const flipCanvas = signal(false);
const sidebarOpen = signal(false);
const toast = signal("");
const loadedTick = signal(0);

/** The export studio composes every download on one square canvas. */
const CANVAS = 512;
const PADDING_MAX = 192;
const SHAPE_MAX = CANVAS / 2;
const RASTER_SIZES = [256, 512, 1024, 2048];
const RASTER_MIN = 16;
const RASTER_MAX = 4096;

type GradDir = "r" | "br" | "b" | "tr";
type Shape = "square" | "rounded" | "circle";
type BgMode = "none" | "solid" | "gradient";
type Format = "svg" | "png" | "jpeg";

/** Gradient direction as userSpaceOnUse coordinates across the canvas. */
const GRADIENT_DIRS: Record<GradDir, [number, number, number, number]> = {
  r: [0, SHAPE_MAX, CANVAS, SHAPE_MAX],
  br: [0, 0, CANVAS, CANVAS],
  b: [SHAPE_MAX, 0, SHAPE_MAX, CANVAS],
  tr: [0, CANVAS, CANVAS, 0],
};
const GRADIENT_LABELS: Record<GradDir, string> = { r: "→", br: "↘", b: "↓", tr: "↗" };

const pad = signal(0);
const shape = signal<Shape>("square");
const cornerRadius = signal(SHAPE_MAX / 2);
const bgMode = signal<BgMode>("none");
const bgColor = signal("#4f46e5");
const bgFrom = signal("#4f46e5");
const bgTo = signal("#ec4899");
const fillGradient = signal(false);
const fgFrom = signal("#f59e0b");
const fgTo = signal("#ec4899");
const gradDir = signal<GradDir>("br");
const pngSize = signal(512);
/** Whether the custom pixel size field is in use, and its draft. */
const customSize = signal(false);
const customSizeText = signal("");
/** The copy and export studio: one dialog both actions open. */
const studioOpen = signal(false);
const format = signal<Format>("svg");
const jpegQuality = signal(85);
/** JPEG has no transparency: the flat color under the canvas and its corners. */
const jpegBg = signal("#ffffff");

/** The app runs in a browser: the only target where a file can be saved. */
const isWeb = platform.os === "web";

/** Each set's icons, kept once loaded; `loadedTick` announces a new set. */
const cache = new Map<string, IconData[]>();

async function iconsOf(meta: DemoSet): Promise<IconData[]> {
  const hit = cache.get(meta.prefix);
  if (hit) return hit;
  const { BODIES } = await LAZY[meta.prefix]();
  const icons = meta.names.map((name, at) => ({ set: meta.prefix, name, body: BODIES[at][0], viewBox: BODIES[at][1], multicolor: meta.multicolor }));
  cache.set(meta.prefix, icons);
  loadedTick.update((n) => n + 1);
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
function baseName(name: string): string {
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
const suffixCounts = computed(() => {
  const meta = pickedSet();
  if (!meta) return [];
  return SUFFIXES.map((token) => ({ token, count: meta.names.filter((name) => name.endsWith(`-${token}`)).length })).filter((chip) => chip.count > 0 && chip.count < meta.names.length);
});
const tiles = computed(() => {
  void loadedTick();
  const meta = pickedSet();
  if (!meta) return [];
  const want = terms();
  const names = suffix() ? meta.names.filter((name) => name.endsWith(`-${suffix()}`)) : meta.names;
  const matched = want.length ? names.filter((name) => want.every((term) => name.includes(term))) : names;
  return matched.slice(0, RESULT_CAP).map((name) => ({ meta, name, icon: byName(meta, name) }));
});
/** Global search: the sets with matches, most first, until you drill into one. */
const setHits = computed(() => {
  const want = terms();
  if (pickedSet() || !want.length) return [];
  return SETS.map((meta) => ({ meta, count: meta.names.filter((name) => want.every((term) => name.includes(term))).length }))
    .filter((hit) => hit.count > 0)
    .sort((a, b) => b.count - a.count);
});
const activeList = computed(() => {
  const current = active();
  return current ? [current] : [];
});
const siblings = computed(() => {
  void loadedTick();
  const current = active();
  if (!current) return [];
  const base = baseName(current.icon.name);
  return current.meta.names
    .filter((name) => name !== current.icon.name && baseName(name) === base)
    .map((name) => byName(current.meta, name))
    .filter((icon): icon is IconData => icon !== undefined)
    .slice(0, 12);
});

const narrow = computed(() => windowSize().width < 900);
/** Room for the detail pane beside the sidebar; below it the detail is a sheet,
 * so the center pane never squeezes under its controls' minimum widths. */
const wide = computed(() => windowSize().width >= 1200);
const columns = computed(() => {
  const width = windowSize().width;
  return width < 400 ? 3 : width < 640 ? 4 : width < 900 ? 5 : width < 1280 ? 6 : 7;
});
/** Home cards hold four sample icons, so they take fewer columns than tiles. */
const homeColumns = computed(() => {
  const width = windowSize().width;
  return width < 640 ? 2 : width < 1280 ? 3 : 4;
});
/** The canvas the icons sit on: the theme's, or the other one while previewed. */
const canvasDark = computed(() => {
  const dark = colorScheme() === "dark";
  return flipCanvas() ? !dark : dark;
});
/** The tint of a monotone icon: the picked color, else one that reads on the canvas. */
const previewColor = () => color() ?? (canvasDark() ? "#f8fafc" : "#0f172a");
const tileFrame = () => (flipCanvas() ? (canvasDark() ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white") : "border-border bg-card");
const tileLabel = () => (flipCanvas() ? (canvasDark() ? "text-slate-400" : "text-slate-500") : "text-muted-foreground");
const total = SETS.reduce((sum, meta) => sum + meta.names.length, 0).toLocaleString();

let searchRef: InputRef | null = null;
let downloader: WebViewRef | null = null;

/** The page real downloads run in: TSX reaches no DOM, so the `<a download>`
 * a file save needs — and the canvas a PNG rasterizes on — live in a web
 * view, whose sandbox allows downloads and keeps scripts off the app. */
const DOWNLOADER = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
addEventListener("message", (event) => {
  let job = null;
  try { job = JSON.parse(String(event.data)); } catch { return; }
  if (!job || job.kind !== "download") return;
  if (!job.width) {
    save(new Blob([job.text], { type: job.mime }), job.name);
    return;
  }
  const source = URL.createObjectURL(new Blob([job.text], { type: "image/svg+xml" }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = job.width;
    canvas.height = job.height;
    const context = canvas.getContext("2d");
    // JPEG has no alpha: job.base fills the canvas first, so transparent
    // corners and a backgroundless SVG land on that color, not on black.
    if (job.base) {
      context.fillStyle = job.base;
      context.fillRect(0, 0, job.width, job.height);
    }
    context.drawImage(image, 0, 0, job.width, job.height);
    URL.revokeObjectURL(source);
    canvas.toBlob((blob) => {
      if (blob) save(blob, job.name);
    }, job.mime, job.quality);
  };
  image.onerror = () => URL.revokeObjectURL(source);
  image.src = source;
});
</script></body></html>`;

function announce(text: string) {
  toast.set(text);
  setTimeout(() => toast.set(""), 1800);
}

/** Hands the composed file to the downloader page; a `bitmap` size turns it
 * into a raster of that pixel size, with `base` under it and a JPEG quality. */
function download(name: string, text: string, mime: string, bitmap?: { size: number; quality?: number; base?: string }) {
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
  announce(`Saving ${name}`);
}

async function openSet(meta: DemoSet) {
  pickedSet.set(meta);
  suffix.set(null);
  sidebarOpen.set(false);
  await iconsOf(meta);
}

async function openIcon(meta: DemoSet, name: string) {
  await iconsOf(meta);
  const icon = byName(meta, name);
  if (icon) active.set({ icon, meta });
}

function copied(what: string, text: string) {
  Clipboard.writeText(text).then(
    () => announce(`Copied ${what}`),
    () => announce("The clipboard said no"),
  );
}

/** The TSX an app pastes: the CLI's named export and the `<Icon>` call. */
function tsSnippet(icon: IconData): string {
  const ident = tsName(icon.set, icon.name);
  return `import { Icon } from "supernsh-icons";\nimport { ${ident} } from "./src/icons";\n\n<Icon icon={${ident}} size={${size()}${color() ? ` color="${color()}"` : ""} label="${baseName(icon.name)}" />`;
}

/** The Rust an app pastes: the Cargo feature, the module's constant, the call. */
function rustSnippet(icon: IconData): string {
  const constant = rustName(icon.set, icon.name);
  const module = icon.set.replace(/-/g, "_");
  return `// Cargo.toml: supernsh-icons = { git = "https://github.com/SuperNSH/icons", features = ["${icon.set}"] }\nuse supernsh_icons::{icon, ${module}};\n\nicon(${module}::${constant}).size(px(${size()}.0))`;
}

/** The bitmap's pixel size: the custom field's value, held to the sane range. */
function raster(): number {
  return Math.min(RASTER_MAX, Math.max(RASTER_MIN, Math.round(pngSize() || 512)));
}

/** What the preview canvas becomes, in the format's own terms. */
function studioCaption(icon: IconData): string {
  const dims = `${icon.viewBox[2]} × ${icon.viewBox[3]} glyph on a ${CANVAS} × ${CANVAS} canvas${icon.multicolor ? " · multicolor" : ""}`;
  if (format() === "svg") return `${dims} · saves as vector`;
  const quality = format() === "jpeg" ? ` at ${jpegQuality()}% quality` : "";
  return `${dims} · saves ${raster()} × ${raster()} px${quality}`;
}

/** Runs the picked format's download from the studio's current settings. */
function runExport(icon: IconData) {
  const base = `${icon.set}-${icon.name}`;
  const markup = studioMarkup(icon, studioOpts());
  if (format() === "svg") download(`${base}.svg`, markup, "image/svg+xml");
  else if (format() === "png") download(`${base}-${raster()}.png`, markup, "image/png", { size: raster() });
  else download(`${base}-${raster()}.jpg`, markup, "image/jpeg", { size: raster(), quality: jpegQuality() / 100, base: jpegBg() });
}

/** The studio's settings as one value, read fresh on every recompose. A JPEG
 * with the background off paints the flat JPEG color instead, so the preview
 * shows the file's real pixels. */
function studioOpts(): {
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
} {
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
    tint: previewColor(),
  };
}

function rounded(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** The composed export document: the icon centered on the padded, shaped,
 * colored canvas. One function writes both the preview and the download, so
 * what you see is byte for byte what you get. */
function studioMarkup(icon: IconData, s: ReturnType<typeof studioOpts>): string {
  const box = CANVAS - 2 * s.pad;
  const [vx, vy, vw, vh] = icon.viewBox;
  const scale = Math.min(box / vw, box / vh);
  const tx = s.pad + (box - vw * scale) / 2 - vx * scale;
  const ty = s.pad + (box - vh * scale) / 2 - vy * scale;
  const [gx1, gy1, gx2, gy2] = GRADIENT_DIRS[s.dir];
  const gradient = (id: string, from: string, to: string) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${gx1}" y1="${gy1}" x2="${gx2}" y2="${gy2}"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
  let defs = "";
  if (s.bg === "gradient") defs += gradient("studio-bg", s.bgFrom, s.bgTo);
  if (s.radius > 0) defs += `<clipPath id="studio-clip"><rect width="${CANVAS}" height="${CANVAS}" rx="${s.radius}"/></clipPath>`;
  const place = `transform="translate(${rounded(tx)} ${rounded(ty)}) scale(${rounded(scale)})"`;
  let iconPart: string;
  if (icon.multicolor || !s.fillGradient) {
    // The tint rides on fill and color: a body may use either, or its own fills.
    const tint = icon.multicolor ? "" : ` fill="${s.tint}" color="${s.tint}"`;
    iconPart = `<g ${place}${tint}>${icon.body}</g>`;
  } else {
    defs += gradient("studio-fill", s.fgFrom, s.fgTo);
    const mask = `<mask id="studio-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${CANVAS}" height="${CANVAS}"><g ${place} fill="#fff" color="#fff">${icon.body}</g></mask>`;
    iconPart = `${mask}<rect x="${s.pad}" y="${s.pad}" width="${box}" height="${box}" fill="url(#studio-fill)" mask="url(#studio-mask)"/>`;
  }
  const bgRect = s.bg === "none" ? "" : `<rect width="${CANVAS}" height="${CANVAS}" rx="${s.radius}" fill="${s.bg === "solid" ? s.bgColor : "url(#studio-bg)"}"/>`;
  const clip = s.radius > 0 ? ` clip-path="url(#studio-clip)"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}"><defs>${defs}</defs><g${clip}>${bgRect}${iconPart}</g></svg>`;
}

/** A whole SVG document as a data URI, for the studio's preview. */
function documentUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function Sidebar() {
  return (
    <View class="w-64 shrink-0 gap-3 p-3">
      <View class="gap-0.5">
        <Text class="text-lg font-semibold text-foreground">nsh-icons</Text>
        <Text class="text-xs text-muted-foreground">{`@iconify/json ${VERSION} · ${SETS.length} sets`}</Text>
      </View>
      <Button
        testID="all-sets"
        onPress={() => {
          pickedSet.set(null);
          sidebarOpen.set(false);
        }}
        class={`rounded-lg border border-border p-2 ${!pickedSet() ? "bg-primary/10" : "bg-card"}`}
      >
        <Text class="text-sm text-foreground">All sets</Text>
      </Button>
      <Scroll class="min-h-0 flex-1">
        <View class="gap-1.5">
          <Each of={SETS}>
            {(meta) => (
              <Button
                testID={`set-${meta().prefix}`}
                onPress={() => openSet(meta())}
                class={`flex-row items-center gap-3 rounded-lg border p-2 text-left ${pickedSet()?.prefix === meta().prefix ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <View class="flex-row gap-1">
                  <Each of={meta().samples.slice(0, 4)}>
                    {(sample) => <Icon icon={sample()} size={16} color={meta().multicolor ? undefined : previewColor()} />}
                  </Each>
                </View>
                <View class="flex-1 gap-0.5">
                  <Text class="line-clamp-1 text-sm font-medium text-foreground">{meta().name}</Text>
                  <Text class={`line-clamp-1 text-xs ${meta().restrictive ? "text-amber-600" : "text-muted-foreground"}`}>{`${meta().names.length.toLocaleString()} · ${meta().license}`}</Text>
                </View>
              </Button>
            )}
          </Each>
        </View>
      </Scroll>
      <View class="gap-2 rounded-lg border border-border bg-card p-3">
        <Text class="text-xs font-medium text-muted-foreground">The same icons as a font</Text>
        <View class="flex-row gap-3">
          <Glyph glyph={phHouseFill} size={22} color="#4f46e5" label="House glyph" />
          <Glyph glyph={phHeartFill} size={22} color="#4f46e5" label="Heart glyph" />
          <Glyph glyph={phStarFill} size={22} color="#4f46e5" label="Star glyph" />
          <Glyph glyph={phGearFill} size={22} color="#4f46e5" label="Gear glyph" />
        </View>
        <Text class="line-clamp-2 text-xs text-muted-foreground">supernsh-icons font builds the .ttf; importing its map registers it.</Text>
      </View>
    </View>
  );
}

function SizeControl() {
  return (
    <View class="h-9 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3">
      <Slider
        testID="size"
        value={size()}
        min={16}
        max={64}
        step={4}
        accessibilityLabel="Icon size"
        onChange={(event) => size.set(event.value as number)}
        class="w-24"
        trackClass="h-6 justify-center"
        indicatorClass="h-1.5 rounded-full bg-muted"
        rangeClass="rounded-full bg-primary"
        thumbClass="size-4 rounded-full border border-border bg-background focus:ring-2 focus:ring-ring"
      >
        <Text testID="size-value" class="w-9 text-right text-xs tabular-nums text-muted-foreground">{`${size()}px`}</Text>
      </Slider>
    </View>
  );
}

function ColorControls() {
  return (
    <View class="flex-row items-center gap-1.5 rounded-lg border border-border bg-card px-1.5 py-1">
      <Button
        testID="color-auto"
        onPress={() => color.set(null)}
        selected={color() === null}
        accessibilityLabel="Automatic tint"
        class={`size-6 items-center justify-center rounded-full border ${color() === null ? "border-primary ring-2 ring-ring" : "border-border"}`}
      >
        <View class="size-4 rounded-full border border-border" />
      </Button>
      <Each of={PRESETS}>
        {(preset) => (
          <ColorSwatch
            color={preset()}
            onPress={() => color.set(preset())}
            accessibilityLabel={`Tint ${preset()}`}
            class={`size-6 rounded-full border ${color() === preset() ? "border-primary ring-2 ring-ring" : "border-transparent"}`}
          />
        )}
      </Each>
      <Popover
        open={pickerOpen()}
        onOpenChange={(event) => pickerOpen.set(event.open)}
        align="end"
        trigger={
          <Button
            testID="color-custom"
            accessibilityLabel="Custom color"
            class={`size-6 items-center justify-center rounded-full border ${color() !== null && color() === customColor() ? "border-primary ring-2 ring-ring" : "border-border"}`}
          >
            <View class="size-4 rounded-full" style={{ backgroundColor: customColor() }} />
          </Button>
        }
        popupClass="w-64 rounded-lg border border-border bg-popover p-3 shadow-lg"
      >
        <ColorPicker
          value={customColor()}
          format="hex"
          onChange={(event) => {
            customColor.set(event.formatted);
            color.set(event.formatted);
          }}
          class="gap-3"
        >
          <ColorArea accessibilityLabel="Shade" class="h-32" panelClass="rounded-md" fillThumb />
          <ColorSlider
            colorSpace="hsb"
            channel="hue"
            accessibilityLabel="Hue"
            class="h-6 justify-center"
            trackClass="h-4 rounded-full"
            thumbClass="size-4 rounded-full border-2 border-background"
            fillThumb
          />
          <View class="flex-row items-center gap-2">
            <ColorSwatch class="size-7 shrink-0 rounded-md border border-border" />
            <ColorField accessibilityLabel="Color as hex" class="h-7 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground" />
          </View>
        </ColorPicker>
      </Popover>
    </View>
  );
}

function Controls() {
  return (
    <View class="flex-row flex-wrap items-center gap-2">
      <View class="min-w-56 flex-1">
        <Input
          testID="search"
          ref={(node) => (searchRef = node)}
          value={query()}
          onChange={(event) => query.set(event.value)}
          accessibilityLabel="Search icons"
          placeholder={`Search ${total} icons (name or variant)`}
          class="rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground"
        />
      </View>
      <SizeControl />
      <ColorControls />
      <Button testID="canvas" onPress={() => flipCanvas.update((flip) => !flip)} class="rounded-lg border border-border bg-card px-2.5 py-1.5">
        <Text class="text-sm text-foreground">{canvasDark() ? "Light canvas" : "Dark canvas"}</Text>
      </Button>
      {narrow() ? (
        <Button testID="sets-button" onPress={() => sidebarOpen.set(true)} class="rounded-lg border border-border bg-card px-2.5 py-1.5">
          <Text class="text-sm text-foreground">Sets</Text>
        </Button>
      ) : (
        <View />
      )}
    </View>
  );
}

function SuffixChips() {
  return (
    <View class="flex-row flex-wrap gap-1.5">
      <Button
        testID="suffix-all"
        onPress={() => suffix.set(null)}
        class={`rounded-full border px-2.5 py-1 ${!suffix() ? "border-primary bg-primary/10" : "border-border"}`}
      >
        <Text class={`text-xs ${!suffix() ? "text-primary" : "text-muted-foreground"}`}>All</Text>
      </Button>
      <Each of={suffixCounts()}>
        {(chip) => (
          <Button
            testID={`suffix-${chip().token}`}
            onPress={() => suffix.set(chip().token)}
            class={`rounded-full border px-2.5 py-1 ${suffix() === chip().token ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <Text class={`text-xs ${suffix() === chip().token ? "text-primary" : "text-muted-foreground"}`}>{`${chip().token} ${chip().count}`}</Text>
          </Button>
        )}
      </Each>
    </View>
  );
}

function Grid() {
  return (
    <Each of={[columns()]}>
      {(count) => (
        <List
          testID="grid"
          each={tiles()}
          numColumns={count()}
          estimatedItemSize={96}
          contentClass="gap-2 p-2"
          class="flex-1"
          footer={() => (tiles().length === RESULT_CAP ? <Text class="p-3 text-center text-xs text-muted-foreground">{`Showing the first ${RESULT_CAP.toLocaleString()} — search to narrow`}</Text> : <View />)}
        >
          {(row) => (
            <Button
              testID={`tile-${row().meta.prefix}-${row().name}`}
              onPress={() => openIcon(row().meta, row().name)}
              class={`items-center gap-1.5 rounded-lg border p-2 ${tileFrame()}`}
            >
              {row().icon ? (
                <Icon icon={row().icon!} size={size()} color={row().icon!.multicolor ? undefined : previewColor()} label={row().name} />
              ) : (
                <View style={{ height: size(), width: size() }} />
              )}
              <Text class={`line-clamp-1 w-full text-center text-[10px] ${tileLabel()}`}>{row().name}</Text>
            </Button>
          )}
        </List>
      )}
    </Each>
  );
}

function Home() {
  return (
    <Each of={[homeColumns()]}>
      {(count) => (
        <List testID="home" each={SETS} numColumns={count()} estimatedItemSize={130} contentClass="gap-2 p-2" class="flex-1">
          {(meta) => (
            <Button testID={`card-${meta().prefix}`} onPress={() => openSet(meta())} class="gap-2 rounded-lg border border-border bg-card p-3">
              <View class="flex-row gap-1.5">
                <Each of={meta().samples}>
                  {(sample) => <Icon icon={sample()} size={18} color={meta().multicolor ? undefined : previewColor()} />}
                </Each>
              </View>
              <Text class="line-clamp-1 text-sm font-medium text-foreground">{meta().name}</Text>
              <Text class={`text-xs ${meta().restrictive ? "text-amber-600" : "text-muted-foreground"}`}>{`${meta().names.length.toLocaleString()} icons · ${meta().license}`}</Text>
            </Button>
          )}
        </List>
      )}
    </Each>
  );
}

function GlobalHits() {
  return (
    <List testID="hits" each={setHits()} estimatedItemSize={56} contentClass="gap-1.5 p-2" class="flex-1">
      {(hit) => (
        <Button testID={`hit-${hit().meta.prefix}`} onPress={() => openSet(hit().meta)} class="flex-row items-center justify-between rounded-lg border border-border bg-card p-3">
          <View class="flex-row items-center gap-2">
            <Each of={hit().meta.samples.slice(0, 3)}>
              {(sample) => <Icon icon={sample()} size={18} color={hit().meta.multicolor ? undefined : previewColor()} />}
            </Each>
            <Text class="text-sm text-foreground">{hit().meta.name}</Text>
          </View>
          <Text class="text-xs text-muted-foreground">{`${hit().count.toLocaleString()} matches`}</Text>
        </Button>
      )}
    </List>
  );
}

function StudioRow(props: { label: string; children: JSX.Element }) {
  return (
    <View class="gap-1.5">
      <Text class="text-xs font-medium text-muted-foreground">{props.label}</Text>
      {props.children}
    </View>
  );
}

function Segmented(props: { testID: string; label: string; value: string; onChange: (id: string) => void; options: Array<{ id: string; label: string }> }) {
  return (
    <View class="flex-row gap-1 rounded-lg border border-border bg-card p-1" accessibilityLabel={props.label}>
      <Each of={props.options}>
        {(option) => (
          <Tab
            testID={`${props.testID}-${option().id}`}
            selected={props.value === option().id}
            onPress={() => props.onChange(option().id)}
            class="flex-1 items-center rounded-md px-1.5 py-1 selected:bg-primary/10"
          >
            <Text class={`text-xs ${props.value === option().id ? "text-primary" : "text-muted-foreground"}`}>{option().label}</Text>
          </Tab>
        )}
      </Each>
    </View>
  );
}

/** One gradient stop: a swatch that opens the picker, bound to one signal. */
function ColorStop(props: { testID: string; label: string; color: string; onPick: (hex: string) => void }) {
  return (
    <Popover
      trigger={
        <Button testID={props.testID} accessibilityLabel={props.label} class="size-7 items-center justify-center rounded-full border border-border">
          <View class="size-5 rounded-full" style={{ backgroundColor: props.color }} />
        </Button>
      }
      popupClass="w-56 rounded-lg border border-border bg-popover p-3 shadow-lg"
    >
      <ColorPicker value={props.color} format="hex" onChange={(event) => props.onPick(event.formatted)} class="gap-3">
        <ColorArea accessibilityLabel="Shade" class="h-28" panelClass="rounded-md" fillThumb />
        <ColorSlider
          colorSpace="hsb"
          channel="hue"
          accessibilityLabel="Hue"
          class="h-6 justify-center"
          trackClass="h-4 rounded-full"
          thumbClass="size-4 rounded-full border-2 border-background"
          fillThumb
        />
        <View class="flex-row items-center gap-2">
          <ColorSwatch class="size-7 shrink-0 rounded-md border border-border" />
          <ColorField accessibilityLabel="Color as hex" class="h-7 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground" />
        </View>
      </ColorPicker>
    </Popover>
  );
}

function DirectionRow() {
  return (
    <View class="flex-row items-center gap-2">
      <Text class="text-xs text-muted-foreground">Direction</Text>
      <View class="flex-row gap-1">
        <Each of={Object.keys(GRADIENT_DIRS) as GradDir[]}>
          {(dir) => (
            <Tab
              testID={`grad-dir-${dir()}`}
              selected={gradDir() === dir()}
              onPress={() => gradDir.set(dir())}
              class="size-8 items-center justify-center rounded-md selected:bg-primary/10"
            >
              <Text class={`text-sm ${gradDir() === dir() ? "text-primary" : "text-muted-foreground"}`}>{GRADIENT_LABELS[dir()]}</Text>
            </Tab>
          )}
        </Each>
      </View>
    </View>
  );
}

/** One language's snippet: the code and the copy button that takes it. */
function CodeCard(props: { testID: string; label: string; code: () => string }) {
  return (
    <View class="gap-1.5 rounded-lg border border-border bg-card p-3">
      <View class="flex-row items-center justify-between gap-2">
        <Text class="text-xs font-medium text-muted-foreground">{props.label}</Text>
        <Button
          testID={props.testID}
          onPress={() => copied(props.label, props.code())}
          accessibilityLabel={`Copy the ${props.label} snippet`}
          class="rounded-md border border-border bg-background px-2 py-1 active:bg-muted"
        >
          <Text class="text-xs text-foreground">Copy</Text>
        </Button>
      </View>
      <Text class="font-mono text-xs leading-5 text-foreground">{props.code()}</Text>
    </View>
  );
}

/** The small exact copies: the id, the raw SVG, the CLI's add command. */
function CopyChips(icon: IconData) {
  const chips: Array<{ id: string; label: string; text: () => string }> = [
    { id: "copy-id", label: "Iconify id", text: () => `${icon.set}:${icon.name}` },
    { id: "copy-svg", label: "SVG markup", text: () => svgMarkup(icon) },
    { id: "copy-add", label: "add command", text: () => `supernsh-icons add ${icon.set}:${icon.name} --out src/icons.ts` },
  ];
  return (
    <View class="flex-row flex-wrap gap-1.5">
      <Each of={chips}>
        {(chip) => (
          <Button
            testID={chip().id}
            onPress={() => copied(chip().label, chip().text())}
            class="rounded-full border border-border bg-card px-2.5 py-1 active:bg-muted"
          >
            <Text class="text-xs text-foreground">{`Copy ${chip().label}`}</Text>
          </Button>
        )}
      </Each>
    </View>
  );
}

/** The download button's own summary: the format, its pixel size and quality. */
function downloadLabel(): string {
  if (format() === "svg") return "Download SVG";
  const quality = format() === "jpeg" ? ` · ${jpegQuality()}%` : "";
  return `Download ${format().toUpperCase()} · ${raster()} px${quality}`;
}

/** The export half of the studio: the format and everything it composes.
 * The preview above is the file: the same markup runs the download. The
 * button saves only where a file can be written; elsewhere it explains. */
function ExportPanel(icon: IconData) {
  return (
    <View class="gap-3 rounded-xl border border-border bg-card p-3">
      <Text class="text-xs font-semibold text-muted-foreground">Export</Text>
      <StudioRow label="Format">
        <Segmented
          testID="studio-format"
          label="Export format"
          value={format()}
          onChange={(id) => format.set(id as Format)}
          options={[
            { id: "svg", label: "SVG" },
            { id: "png", label: "PNG" },
            { id: "jpeg", label: "JPEG" },
          ]}
        />
      </StudioRow>
      {format() === "svg" ? (
        <Text class="text-xs text-muted-foreground">SVG keeps the glyph a vector: any size, transparent background.</Text>
      ) : (
        <StudioRow label="Pixel size">
          <Segmented
            testID="studio-size"
            label="Pixel size"
            value={customSize() ? "custom" : String(pngSize())}
            onChange={(id) => {
              customSize.set(id === "custom");
              customSizeText.set("");
              if (id !== "custom") pngSize.set(Number(id));
            }}
            options={[...RASTER_SIZES.map((pixels) => ({ id: String(pixels), label: String(pixels) })), { id: "custom", label: "Custom" }]}
          />
          {customSize() ? (
            <Input
              testID="studio-size-input"
              value={customSizeText()}
              placeholder={String(pngSize())}
              onChange={(event) => {
                customSizeText.set(event.value);
                const pixels = Number.parseInt(event.value, 10);
                if (Number.isFinite(pixels) && pixels >= RASTER_MIN) pngSize.set(Math.min(RASTER_MAX, pixels));
              }}
              accessibilityLabel="Custom pixel size"
              class="h-9 rounded-md border border-input bg-background px-2 font-mono text-sm text-foreground"
            />
          ) : (
            <View />
          )}
        </StudioRow>
      )}
      {format() === "jpeg" ? (
        <StudioRow label="JPEG quality">
          <Slider
            testID="studio-quality"
            value={jpegQuality()}
            min={40}
            max={100}
            step={5}
            accessibilityLabel="JPEG quality"
            onChange={(event) => jpegQuality.set(event.value as number)}
            class="w-full"
            trackClass="h-6 justify-center"
            indicatorClass="h-1.5 rounded-full bg-muted"
            rangeClass="rounded-full bg-primary"
            thumbClass="size-4 rounded-full border border-border bg-background focus:ring-2 focus:ring-ring"
          >
            <Text class="w-9 text-right text-xs tabular-nums text-muted-foreground">{`${jpegQuality()}%`}</Text>
          </Slider>
        </StudioRow>
      ) : (
        <View />
      )}
      {format() === "jpeg" && bgMode() === "none" ? (
        <StudioRow label="JPEG background">
          <View class="flex-row items-center gap-2">
            <ColorStop testID="studio-jpeg-base" label="JPEG background color" color={jpegBg()} onPick={(hex) => jpegBg.set(hex)} />
            <Text class="font-mono text-xs text-muted-foreground">{jpegBg()}</Text>
          </View>
          <Text class="text-xs text-muted-foreground">JPEG has no transparency: this fills the canvas and its corners.</Text>
        </StudioRow>
      ) : (
        <View />
      )}
      <StudioRow label="Padding">
        <Slider
          testID="studio-pad"
          value={pad()}
          min={0}
          max={PADDING_MAX}
          step={4}
          accessibilityLabel="Padding around the icon"
          onChange={(event) => pad.set(event.value as number)}
          class="w-full"
          trackClass="h-6 justify-center"
          indicatorClass="h-1.5 rounded-full bg-muted"
          rangeClass="rounded-full bg-primary"
          thumbClass="size-4 rounded-full border border-border bg-background focus:ring-2 focus:ring-ring"
        >
          <Text class="w-9 text-right text-xs tabular-nums text-muted-foreground">{`${pad()}`}</Text>
        </Slider>
      </StudioRow>
      <StudioRow label="Shape">
        <Segmented
          testID="studio-shape"
          label="Icon shape"
          value={shape()}
          onChange={(id) => shape.set(id as Shape)}
          options={[
            { id: "square", label: "Square" },
            { id: "rounded", label: "Rounded" },
            { id: "circle", label: "Circle" },
          ]}
        />
        {shape() === "rounded" ? (
          <Slider
            testID="studio-radius"
            value={cornerRadius()}
            min={0}
            max={SHAPE_MAX}
            step={8}
            accessibilityLabel="Corner radius"
            onChange={(event) => cornerRadius.set(event.value as number)}
            class="w-full"
            trackClass="h-6 justify-center"
            indicatorClass="h-1.5 rounded-full bg-muted"
            rangeClass="rounded-full bg-primary"
            thumbClass="size-4 rounded-full border border-border bg-background focus:ring-2 focus:ring-ring"
          >
            <Text class="w-9 text-right text-xs tabular-nums text-muted-foreground">{`${Math.round((cornerRadius() / SHAPE_MAX) * 100)}%`}</Text>
          </Slider>
        ) : (
          <View />
        )}
      </StudioRow>
      <StudioRow label="Background">
        <Segmented
          testID="studio-bg"
          label="Background"
          value={bgMode()}
          onChange={(id) => bgMode.set(id as BgMode)}
          options={[
            { id: "none", label: "None" },
            { id: "solid", label: "Solid" },
            { id: "gradient", label: "Gradient" },
          ]}
        />
        {bgMode() === "solid" ? (
          <View class="flex-row items-center gap-2">
            <ColorStop testID="studio-bg-color" label="Background color" color={bgColor()} onPick={(hex) => bgColor.set(hex)} />
            <Text class="font-mono text-xs text-muted-foreground">{bgColor()}</Text>
          </View>
        ) : bgMode() === "gradient" ? (
          <View class="flex-row items-center gap-2">
            <ColorStop testID="studio-bg-from" label="Gradient start" color={bgFrom()} onPick={(hex) => bgFrom.set(hex)} />
            <ColorStop testID="studio-bg-to" label="Gradient end" color={bgTo()} onPick={(hex) => bgTo.set(hex)} />
          </View>
        ) : (
          <View />
        )}
      </StudioRow>
      <StudioRow label="Icon fill">
        <Segmented
          testID="studio-fill"
          label="Icon fill"
          value={icon.multicolor || !fillGradient() ? "tint" : "gradient"}
          onChange={(id) => fillGradient.set(id === "gradient")}
          options={icon.multicolor ? [{ id: "tint", label: "Own colors" }] : [{ id: "tint", label: "Tint" }, { id: "gradient", label: "Gradient" }]}
        />
        {fillGradient() && !icon.multicolor ? (
          <View class="flex-row items-center gap-2">
            <ColorStop testID="studio-fg-from" label="Fill gradient start" color={fgFrom()} onPick={(hex) => fgFrom.set(hex)} />
            <ColorStop testID="studio-fg-to" label="Fill gradient end" color={fgTo()} onPick={(hex) => fgTo.set(hex)} />
          </View>
        ) : (
          <View />
        )}
      </StudioRow>
      {bgMode() === "gradient" || (fillGradient() && !icon.multicolor) ? (
        <DirectionRow />
      ) : (
        <View />
      )}
      {isWeb ? (
        <Button
          testID="studio-download"
          onPress={() => runExport(icon)}
          class="items-center rounded-lg bg-primary px-3 py-2.5 active:bg-primary/90"
        >
          <Text class="text-sm font-semibold text-primary-foreground">{downloadLabel()}</Text>
        </Button>
      ) : (
        <View
          role="button"
          accessibilityLabel="Saving files needs the web build"
          accessibilityState={{ disabled: true }}
          class="items-center rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <Text class="text-sm text-muted-foreground">{`Saving ${format().toUpperCase()} files needs the web build`}</Text>
        </View>
      )}
      <Text class="text-center text-xs text-muted-foreground">The download is this preview, byte for byte.</Text>
    </View>
  );
}

/** The copy and export studio: the composed preview, the TS and Rust an app
 * pastes, the small exact copies, and the format's download. Both detail
 * actions open it. */
function StudioModal() {
  return (
    <Dialog
      testID="studio"
      open={studioOpen() && active() !== null}
      animation="fade"
      onOpenChange={(event) => studioOpen.set(event.open)}
      backdropClass="bg-black/50"
      class="m-auto h-[90%] w-11/12 max-w-lg flex-col rounded-xl border border-border bg-popover shadow-2xl"
    >
      <Each of={activeList()}>
        {(current) => {
          const icon = current().icon;
          return (
            <View class="min-h-0 flex-1 flex-col">
              <View class="flex-row items-center gap-2 border-b border-border px-4 py-3">
                <View class="min-w-0 flex-1 gap-0.5">
                  <Text class="line-clamp-1 font-mono text-sm font-medium text-foreground">{`${icon.set}:${icon.name}`}</Text>
                  <Text class="line-clamp-1 text-xs text-muted-foreground">{`${current().meta.name} · ${current().meta.license}${current().meta.restrictive ? " (asks attribution or limits use)" : ""}`}</Text>
                </View>
                <Button
                  testID="studio-close"
                  accessibilityLabel="Close the studio"
                  onPress={() => studioOpen.set(false)}
                  class="size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card active:bg-muted"
                >
                  <Text class="text-sm text-muted-foreground">✕</Text>
                </Button>
              </View>
              <Scroll class="min-h-0 flex-1">
                <View class="gap-4 p-4">
                  <View class="items-center gap-2 py-1">
                    <Image
                      testID="studio-preview"
                      src={documentUri(studioMarkup(icon, studioOpts()))}
                      style={{ width: 176, height: 176 }}
                      accessibilityLabel="Export preview"
                    />
                    <Text class="text-center text-xs text-muted-foreground">{studioCaption(icon)}</Text>
                  </View>
                  <CodeCard testID="copy-ts" label="Use in TypeScript" code={() => tsSnippet(icon)} />
                  <CodeCard testID="copy-rust" label="Use in Rust" code={() => rustSnippet(icon)} />
                  {CopyChips(icon)}
                  {ExportPanel(icon)}
                </View>
              </Scroll>
              {/* The dialog is its own window layer above the app's, so this is
               * where the copies' and downloads' toast can be seen. */}
              {toast() ? (
                <View class="absolute bottom-4 left-4 right-4 items-center rounded-lg bg-primary px-3 py-2 shadow-lg">
                  <Text class="text-sm text-primary-foreground">{toast()}</Text>
                </View>
              ) : (
                <View />
              )}
            </View>
          );
        }}
      </Each>
    </Dialog>
  );
}

function Detail() {
  return (
    <Scroll testID="detail" class={wide() ? "w-80 shrink-0 border-l border-border" : "w-80 max-w-full"}>
      <View class="gap-4 p-4">
        <Each of={activeList()}>
          {(current) => {
            const icon = current().icon;
            return (
              <View class="gap-4">
                <View class="items-center py-2">
                  <View class={`items-center justify-center rounded-xl border p-6 ${tileFrame()}`}>
                    <Icon icon={icon} size={72} color={icon.multicolor ? undefined : previewColor()} label={icon.name} />
                  </View>
                </View>
                <View class="gap-1">
                  <Text testID="detail-id" class="font-mono text-sm font-medium text-foreground">{`${icon.set}:${icon.name}`}</Text>
                  <Text class="line-clamp-1 text-xs text-muted-foreground">{`${current().meta.name} · ${current().meta.license}${current().meta.restrictive ? " (asks attribution or limits use)" : ""}`}</Text>
                  <Text class="text-xs text-muted-foreground">{`${icon.viewBox[2]} × ${icon.viewBox[3]} glyph${icon.multicolor ? " · multicolor" : ""}`}</Text>
                </View>
                <View class="flex-row gap-2">
                  <Button
                    testID="action-copy"
                    accessibilityLabel="Copy snippets for this icon"
                    onPress={() => studioOpen.set(true)}
                    class="flex-1 items-center rounded-lg border border-border bg-card px-3 py-2 active:bg-muted"
                  >
                    <Text class="text-sm font-medium text-foreground">Copy</Text>
                  </Button>
                  <Button
                    testID="action-export"
                    accessibilityLabel="Open the export studio"
                    onPress={() => studioOpen.set(true)}
                    class="flex-1 items-center rounded-lg bg-primary px-3 py-2 active:bg-primary/90"
                  >
                    <Text class="text-sm font-medium text-primary-foreground">Export</Text>
                  </Button>
                </View>
                <View class="gap-2">
                  <Text class="text-xs font-medium text-muted-foreground">Variants</Text>
                  <View class="flex-row flex-wrap gap-2">
                    <Each of={siblings()}>
                      {(sibling) => (
                        <Button
                          testID={`sibling-${sibling().name}`}
                          onPress={() => openIcon(current().meta, sibling().name)}
                          class="items-center gap-1 rounded-lg border border-border bg-card p-1.5"
                        >
                          <Icon icon={sibling()} size={20} color={sibling().multicolor ? undefined : previewColor()} />
                          <Text class="line-clamp-1 w-16 text-center text-[10px] text-muted-foreground">
                            {sibling().name.slice(baseName(current().icon.name).length).replace(/^-/, "") || "base"}
                          </Text>
                        </Button>
                      )}
                    </Each>
                  </View>
                </View>
              </View>
            );
          }}
        </Each>
      </View>
    </Scroll>
  );
}

function App() {
  keymap.bind("mod+k", () => searchRef?.focus());
  effect(() => {
    const meta = pickedSet();
    if (meta && !cache.has(meta.prefix)) void iconsOf(meta);
  });
  return (
    <View class="flex-1 flex-row bg-background">
      {isWeb ? <WebView ref={(node) => (downloader = node)} html={DOWNLOADER} class="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0" /> : <View />}
      {narrow() ? (
        <Sheet open={sidebarOpen()} side="left" onOpenChange={(event) => sidebarOpen.set(event.open)}>
          <Sidebar />
        </Sheet>
      ) : (
        <Sidebar />
      )}
      {(() => {
        void loadedTick();
        if (pickedSet()) {
          return (
            <View class="flex min-w-0 flex-1 flex-col gap-3 p-3">
              <Controls />
              <SuffixChips />
              {tiles().length ? (
                <Grid />
              ) : (
                <Text class="p-8 text-center text-sm text-muted-foreground">{`Nothing in ${pickedSet()!.name} matches that`}</Text>
              )}
            </View>
          );
        }
        return (
          <View class="flex min-w-0 flex-1 flex-col gap-3 p-3">
            <Controls />
            {terms().length ? (
              setHits().length ? (
                <GlobalHits />
              ) : (
                <Text class="p-8 text-center text-sm text-muted-foreground">{`No bundled icon matches ${query()}`}</Text>
              )
            ) : (
              <Home />
            )}
          </View>
        );
      })()}
      {wide() ? (
        active() ? (
          <Detail />
        ) : (
          <View />
        )
      ) : (
        <Sheet open={active() !== null} side="right" onOpenChange={(event) => !event.open && active.set(null)}>
          <Detail />
        </Sheet>
      )}
      <StudioModal />
    </View>
  );
}

mount(App);
