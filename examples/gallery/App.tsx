// The icon explorer: every bundled set's icons, searchable, with variant
// filters, sibling variants, and the snippets an app pastes. The data is
// `supernsh-icons gallery`'s: src/demo-index.ts for names, src/data/ for bodies.
import { effect, keymap, List, mount, platform, Scroll, Text, View, WebView, token, type InputRef, type ListRef } from "nsh";
import { Button as Pressable, ColorSwatch, Input, Popover, Slider } from "nsh/base";
import { Glyph, Icon, type IconData } from "supernsh-icons";
import {
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideCopy,
  lucideImageDown,
  lucideLayoutGrid,
  lucideMonitor,
  lucideMoon,
  lucideSearch,
  lucideSun,
  lucideType,
  lucideX,
} from "supernsh-icons-lucide";
import { SETS, VERSION, type DemoSet } from "./src/demo-index";
import { phGearFill, phHeartFill, phHouseFill, phStarFill } from "./src/icon-font";
import { Studio } from "./src/studio-view";
import {
  activeIcon,
  baseName,
  canvasMode,
  capLabel,
  clearSearch,
  closeDetail,
  closeSidebar,
  closeStudio,
  columns,
  copy,
  currentSet,
  customColor,
  exactCopies,
  hasQuery,
  homeColumns,
  iconSize,
  ink,
  isActive,
  isCapped,
  isCopied,
  isSidebarOpen,
  isStudioOpen,
  isWeb,
  jumpToIcon,
  loadBodies,
  narrow,
  openIcon,
  openSet,
  openSidebar,
  openStudio,
  presets,
  previewFrame,
  queryText,
  roomy,
  rustSnippet,
  setCanvas,
  setCustomColor,
  setDownloader,
  setHits,
  setQuery,
  setSize,
  setSuffix,
  setTint,
  showAllSets,
  siblings,
  suffixChosen,
  suffixCounts,
  surface,
  tiles,
  tintPicked,
  toolbarRows,
  total,
  tsSnippet,
  wide,
} from "./src/store";
import { Button, IconButton, control } from "./src/ui/button";
import { Chip } from "./src/ui/chip";
import { CodeBlock } from "./src/ui/code";
import { Picker, swatch, swatchSelected } from "./src/ui/color";
import { License } from "./src/ui/license";
import { Segmented } from "./src/ui/segmented";
import { sliderIndicator, sliderRange, sliderThumb, sliderTrack } from "./src/ui/slider";
import { popup, TOUCH } from "./src/ui/theme";
import { Toaster } from "./src/ui/toast";

/** A pointer drives the app: the search field keeps room for a shortcut hint. */
const DESKTOP = platform.desktop;

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

let searchRef: InputRef | null = null;
/** The sidebar's list of sets, so the one just entered can be brought into view. */
let setList: ListRef | null = null;

/** A sidebar row: quiet until hovered, tinted while it is the current set. */
function navRow(selected: boolean) {
  return `flex-row items-center gap-3 rounded-(--radius) px-2 py-1.5 ${selected ? "bg-primary/10 font-medium text-primary" : "hover:bg-sidebar-accent active:bg-sidebar-accent"}`;
}

/** The frame a control gets when the keyboard's focus is on it. */
const focus = "focus-visible:ring-2 focus-visible:ring-ring";

/** A set's first samples, two by two: how one row is told from its neighbors. */
function Thumbnail(props: { meta: DemoSet }) {
  return (
    <View class="size-9 shrink-0 flex-row flex-wrap items-center justify-center gap-1 overflow-hidden rounded-md bg-background p-0.5">
      <Each of={props.meta.samples.slice(0, 4)}>
        {(sample) => <Icon icon={sample()} size={12} color={token("foreground")} />}
      </Each>
    </View>
  );
}

function Sidebar() {
  // A set picked in the sidebar is in view already; one picked on the home grid need not be.
  let wasInSet = false;
  effect(() => {
    const meta = currentSet();
    if (meta && !wasInSet) setList?.scrollToIndex({ index: SETS.findIndex((set) => set.prefix === meta.prefix), viewPosition: 0.5 });
    wasInSet = meta !== null;
  });
  return (
    <View class="w-64 shrink-0 gap-3 border-e border-sidebar-border bg-sidebar p-3 pt-[calc(env(safe-area-inset-top)+12px)] text-sidebar-foreground">
      <View class="gap-0.5 px-2">
        <Text class="text-sm font-semibold text-foreground">supernsh-icons</Text>
        <Text class="text-xs text-muted-foreground">{`${SETS.length} sets · ${total.toLocaleString()} icons`}</Text>
      </View>
      <View role="navigation" accessibilityLabel="Icon sets" class="min-h-0 flex-1 gap-1">
        <Pressable testID="all-sets" onPress={showAllSets} class={`${navRow(!currentSet())} ${focus}`}>
          <View class="size-9 shrink-0 items-center justify-center">
            <Icon icon={lucideLayoutGrid} size={18} />
          </View>
          <Text class="flex-1 text-sm">All sets</Text>
        </Pressable>
        <List ref={(node) => (setList = node)} each={SETS} keyExtractor={(meta) => meta.prefix} estimatedItemSize={52} class="min-h-0 flex-1" contentClass="gap-1">
          {(meta) => (
            <Pressable testID={`set-${meta().prefix}`} onPress={() => openSet(meta())} class={`${navRow(currentSet()?.prefix === meta().prefix)} ${focus}`}>
              <Thumbnail meta={meta()} />
              <Text class="line-clamp-1 min-w-0 flex-1 text-sm">{meta().name}</Text>
            </Pressable>
          )}
        </List>
      </View>
      <Text class="px-2 text-xs text-muted-foreground">{`@iconify/json ${VERSION}`}</Text>
    </View>
  );
}

/** On a narrow window the sidebar is a sheet over the stage. */
function SidebarSheet() {
  return (
    <View class="absolute inset-0 z-40 flex-row pt-[env(safe-area-inset-top)]">
      <View testID="sets-backdrop" role="button" accessibilityLabel="Close the sets panel" onPress={closeSidebar} class="absolute inset-0 bg-scrim/50" />
      {/* The panel swallows presses, so taps on its quiet spots stay off the backdrop. */}
      <View class="relative h-full w-64 flex-row bg-sidebar shadow-2xl" onPress={() => {}}>
        <Sidebar />
      </View>
    </View>
  );
}

/** The raw SVG and the install commands, each one press from the clipboard. */
function CopyRow(props: { icon: IconData }) {
  return (
    <View class="flex-row flex-wrap gap-2">
      <Each of={exactCopies(props.icon)} key={(entry) => entry.id}>
        {(entry) => (
          <Button testID={entry().id} size="sm" onPress={() => copy(entry().id, entry().text)} accessibilityLabel={`Copy ${entry().label}`}>
            <Icon icon={isCopied(entry().id) ? lucideCheck : lucideCopy} size={14} />
            <Text>{`Copy ${entry().label}`}</Text>
          </Button>
        )}
      </Each>
    </View>
  );
}

/** The search over every icon name, with the shortcut that brings it back. */
function SearchField(props: { floor: boolean }) {
  return (
    <View class={`${props.floor ? "min-w-56" : "min-w-0"} flex-1 flex-row items-center gap-2 rounded-(--radius) border border-input bg-card pe-1 ps-3 ${TOUCH ? "min-h-10" : "min-h-8"} focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30`}>
      <Icon icon={lucideSearch} size={16} color={token("muted-foreground")} />
      <Input
        testID="search"
        ref={(node) => (searchRef = node)}
        value={queryText()}
        onChange={(event) => setQuery(event.value)}
        accessibilityLabel="Search icons"
        placeholder={`Search ${total.toLocaleString()} icons`}
        class="min-w-0 flex-1 py-1.5 text-sm text-foreground"
      />
      <If when={DESKTOP && !queryText()}>
        <Text class="rounded border border-border bg-muted px-1 font-mono text-xs text-muted-foreground">{keymap.label("mod+k")}</Text>
      </If>
      <If when={queryText()}>
        <IconButton testID="search-clear" size="sm" label="Clear search" onPress={clearSearch}>
          <Icon icon={lucideX} size={16} />
        </IconButton>
      </If>
    </View>
  );
}

/** Size, tint and canvas: after the search where the window is wide, else a row of their own. */
function Controls(props: { own: boolean }) {
  return (
    <View class={`flex-row items-center gap-2${props.own ? " min-w-0 flex-1" : ""}`}>
      <View class={props.own ? "min-w-0 flex-1 flex-row items-center gap-2" : "flex-row items-center gap-2"}>
        <If when={roomy()}>
          <Text class="text-xs text-muted-foreground">Size</Text>
        </If>
        <Slider
          testID="size"
          value={iconSize()}
          min={16}
          max={64}
          step={4}
          accessibilityLabel="Icon size"
          onChange={(event) => {
            if (typeof event.value === "number") setSize(event.value);
          }}
          class={props.own ? "min-w-28 flex-1 flex-row items-center gap-2" : "w-40 flex-row items-center gap-2"}
          trackClass={sliderTrack}
          indicatorClass={sliderIndicator}
          rangeClass={sliderRange}
          thumbClass={sliderThumb}
        >
          <Text testID="size-value" class="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">{`${iconSize()}px`}</Text>
        </Slider>
      </View>
      <Popover
        align="end"
        trigger={
          <Pressable
            testID="tint"
            accessibilityLabel="Tint"
            class={`flex-row items-center gap-1.5 rounded-(--radius) border border-border bg-card px-3 ${TOUCH ? "min-h-10 py-2 text-sm" : "min-h-8 py-1 text-xs"} font-medium text-foreground hover:bg-muted active:bg-muted ${focus}`}
          >
            {/* The ink sits in a ring: a light one would vanish into the button. */}
            <View class="size-4 items-center justify-center rounded-full border border-border">
              <View class="size-2.5 rounded-full" style={{ backgroundColor: ink() }} />
            </View>
            <If when={roomy()}>
              <Text>Tint</Text>
            </If>
            <Icon icon={lucideChevronDown} size={14} />
          </Pressable>
        }
        popupClass={`w-64 p-3 ${popup}`}
      >
        <View class="gap-3">
          <View class="flex-row items-center gap-2">
            <Pressable testID="color-auto" onPress={() => setTint(null)} accessibilityLabel="Automatic tint" class={tintPicked() === null ? swatchSelected : swatch}>
              {/* Half filled: the tint follows whatever the icon is drawn on. */}
              <View class="size-4 overflow-hidden rounded-full border border-border">
                <View class="absolute inset-y-0 end-0 w-1/2 bg-foreground" />
              </View>
            </Pressable>
            <Each of={presets}>
              {(preset) => (
                <ColorSwatch
                  color={preset()}
                  onPress={(event) => setTint(event.color)}
                  accessibilityLabel={`Tint ${preset()}`}
                  class={tintPicked() === preset() ? swatchSelected : swatch}
                />
              )}
            </Each>
            <ColorSwatch
              testID="color-custom"
              color={customColor()}
              onPress={() => setTint(customColor())}
              accessibilityLabel="Custom color"
              class={tintPicked() !== null && tintPicked() === customColor() ? swatchSelected : swatch}
            />
          </View>
          <Picker
            value={customColor()}
            onChange={(hex) => {
              setCustomColor(hex);
              setTint(hex);
            }}
          />
        </View>
      </Popover>
      <Segmented
        label="Canvas"
        testID="canvas"
        value={canvasMode()}
        onChange={setCanvas}
        options={[
          { id: "theme", label: roomy() ? "Theme" : "", accessibilityLabel: "The app's appearance", icon: <Icon icon={lucideMonitor} size={14} /> },
          { id: "light", label: roomy() ? "Light" : "", accessibilityLabel: "Light canvas", icon: <Icon icon={lucideSun} size={14} /> },
          { id: "dark", label: roomy() ? "Dark" : "", accessibilityLabel: "Dark canvas", icon: <Icon icon={lucideMoon} size={14} /> },
        ]}
      />
    </View>
  );
}

function Toolbar() {
  return (
    <View class="gap-2 p-3">
      <View class="flex-row items-center gap-2">
        <If when={narrow()}>
          <Button testID="sets-button" size={control} onPress={openSidebar} class="gap-1.5">
            <Icon icon={lucideLayoutGrid} size={14} />
            <Text>Sets</Text>
          </Button>
        </If>
        <SearchField floor={!toolbarRows()} />
        <If when={!toolbarRows()}>
          {() => <Controls own={false} />}
        </If>
      </View>
      <If when={toolbarRows()}>
        {() => <Controls own={true} />}
      </If>
    </View>
  );
}

/** The page's title and what it holds, above the set cards. */
function HomeHeader() {
  return (
    <View class="flex-row items-baseline justify-between gap-3">
      <Text role="header" class="text-lg font-semibold text-foreground">
        All sets
      </Text>
      <Text class="text-xs text-muted-foreground">{`${SETS.length} sets · ${total.toLocaleString()} icons`}</Text>
    </View>
  );
}

/** The font form of the same icons, for the app that wants one file. */
function FontCard() {
  return (
    <View class="flex-row items-center gap-4 rounded-xl border border-border bg-card p-3">
      <View class="min-w-0 flex-1 gap-1">
        <View class="flex-row items-center gap-1.5">
          <Icon icon={lucideType} size={14} />
          <Text class="text-sm font-medium text-foreground">The same icons as a font</Text>
        </View>
        <Text class="text-xs leading-5 text-muted-foreground">supernsh-icons font builds a .ttf of the icons you list; importing its map registers the family.</Text>
      </View>
      <View class="shrink-0 flex-row gap-3">
        <Glyph glyph={phHouseFill} size={22} color={token("primary")} label="House glyph" />
        <Glyph glyph={phHeartFill} size={22} color={token("primary")} label="Heart glyph" />
        <Glyph glyph={phStarFill} size={22} color={token("primary")} label="Star glyph" />
        <Glyph glyph={phGearFill} size={22} color={token("primary")} label="Gear glyph" />
      </View>
    </View>
  );
}

function Home() {
  return (
    <Each of={[homeColumns()]}>
      {(count) => (
        <List
          testID="home"
          each={SETS}
          numColumns={count()}
          estimatedItemSize={90}
          contentClass="gap-3 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
          class="flex-1"
          header={<HomeHeader />}
          footer={<FontCard />}
        >
          {(meta) => (
            <Pressable
              testID={`card-${meta().prefix}`}
              onPress={() => openSet(meta())}
              class={`gap-2 rounded-xl border border-border bg-card p-3 hover:bg-muted/50 active:bg-muted ${focus}`}
            >
              <View class="flex-row gap-3">
                <Each of={meta().samples.slice(0, 4)}>
                  {(sample) => <Icon icon={sample()} size={20} color={token("foreground")} />}
                </Each>
              </View>
              <View class="gap-0.5">
                <Text class="line-clamp-1 text-sm font-medium text-foreground">{meta().name}</Text>
                <Text class={`line-clamp-1 text-xs ${meta().restrictive ? "text-warning" : "text-muted-foreground"}`}>
                  {`${meta().names.length.toLocaleString()} icons · ${meta().license}`}
                </Text>
              </View>
            </Pressable>
          )}
        </List>
      )}
    </Each>
  );
}

/** Global search: each set with matches, and names to jump straight to an icon. */
function GlobalHits() {
  return (
    <List testID="hits" each={setHits()} keyExtractor={(hit) => hit.meta.prefix} estimatedItemSize={98} contentClass="gap-2 p-3" class="flex-1">
      {(hit) => (
        <View class="gap-1 rounded-xl border border-border bg-card p-2">
          <Pressable
            testID={`hit-${hit().meta.prefix}`}
            onPress={() => openSet(hit().meta)}
            class={`flex-row items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted active:bg-muted ${focus}`}
          >
            <Thumbnail meta={hit().meta} />
            <Text class="line-clamp-1 min-w-0 flex-1 text-sm font-medium text-foreground">{hit().meta.name}</Text>
            <Text class="text-xs tabular-nums text-muted-foreground">{`${hit().count.toLocaleString()} matches`}</Text>
            <Icon icon={lucideChevronRight} size={16} color={token("muted-foreground")} />
          </Pressable>
          <View class="flex-row flex-wrap gap-1.5 ps-2">
            <Each of={hit().names} key={(name) => name}>
              {(name) => (
                <Pressable
                  testID={`hit-${hit().meta.prefix}-${name()}`}
                  onPress={() => jumpToIcon(hit().meta, name())}
                  class={`rounded-md bg-muted px-1.5 py-0.5 hover:bg-secondary active:bg-secondary ${focus}`}
                >
                  <Text class="font-mono text-xs text-foreground">{name()}</Text>
                </Pressable>
              )}
            </Each>
          </View>
        </View>
      )}
    </List>
  );
}

/** Nothing to show: say why, and the way back. */
function EmptyState(props: { title: string }) {
  return (
    <View class="flex-1 items-center justify-center gap-3 p-8">
      <Text class="text-center text-sm font-medium text-foreground">{props.title}</Text>
      <Button size="sm" onPress={clearSearch}>
        <Text>Clear search</Text>
      </Button>
    </View>
  );
}

/** No set picked: the set cards, or what the search found across all of them. */
function Browse() {
  return (
    <If when={hasQuery()} else={<Home />}>
      {() => (
        <If when={setHits().length} else={<EmptyState title={`No bundled icon matches “${queryText()}”`} />}>
          <GlobalHits />
        </If>
      )}
    </If>
  );
}

function SuffixChips() {
  return (
    <View class="flex-row flex-wrap gap-1.5">
      <Chip testID="suffix-all" label="All" selected={!suffixChosen()} onPress={() => setSuffix(null)} />
      <Each of={suffixCounts()} key={(chip) => chip.token}>
        {(chip) => (
          <Chip testID={`suffix-${chip().token}`} label={`${chip().token} ${chip().count}`} selected={suffixChosen() === chip().token} onPress={() => setSuffix(chip().token)} />
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
          keyExtractor={(tile) => `${tile.meta.prefix}:${tile.name}`}
          numColumns={count()}
          estimatedItemSize={78}
          contentClass="gap-1 px-3 pt-1 pb-[calc(env(safe-area-inset-bottom)+8px)]"
          class={`min-h-0 flex-1 ${surface().field}`}
          footer={
            isCapped() ? (
              <Text class={`py-2 text-center text-xs ${surface().muted}`}>{capLabel()}</Text>
            ) : undefined
          }
        >
          {(row) => (
            <Pressable
              testID={`tile-${row().meta.prefix}-${row().name}`}
              onPress={() => {
                searchRef?.blur();
                openIcon(row().meta, row().name);
              }}
              selected={isActive(row().meta.prefix, row().name)}
              class={`items-center gap-1.5 rounded-lg p-2 ${surface().hover} active:bg-primary/20 ${focus}`}
              classList={{ "bg-primary/15": isActive(row().meta.prefix, row().name) }}
            >
              {row().icon ? (
                <Icon icon={row().icon!} size={iconSize()} color={ink()} />
              ) : (
                <View style={{ height: iconSize(), width: iconSize() }} />
              )}
              <Text class={`w-full line-clamp-1 text-center text-xs ${isActive(row().meta.prefix, row().name) ? surface().ink : surface().muted}`}>
                {row().name}
              </Text>
            </Pressable>
          )}
        </List>
      )}
    </Each>
  );
}

function SetView(props: { meta: DemoSet }) {
  return (
    <View class="min-h-0 flex-1 flex-col">
      <View class="gap-1 px-3 pb-2">
        <View class="flex-row items-baseline gap-3">
          <Text role="header" class="line-clamp-1 min-w-0 flex-1 text-lg font-semibold text-foreground">
            {props.meta.name}
          </Text>
          <Text class="shrink-0 text-sm tabular-nums text-muted-foreground">{`${props.meta.names.length.toLocaleString()} icons`}</Text>
        </View>
        <License meta={props.meta} />
      </View>
      <If when={suffixCounts().length}>
        <View class="flex-row flex-wrap gap-1.5 px-3 pb-2">
          <SuffixChips />
        </View>
      </If>
      <If when={tiles().length} else={<EmptyState title={`Nothing in ${props.meta.name} matches “${queryText()}”`} />}>
        <Grid />
      </If>
    </View>
  );
}

function DetailEmpty() {
  return (
    <View class="grow items-center justify-center gap-2 p-6">
      <Text class="text-center text-sm font-medium text-foreground">No icon selected</Text>
      <Text class="text-center text-xs leading-5 text-muted-foreground">Choose an icon in the grid. Its code and variants show here.</Text>
    </View>
  );
}

/** What a variant adds to its base name; `base` when it is the base itself. */
function variantLabel(name: string) {
  return name.slice(baseName(name).length).replace(/^-/, "") || "base";
}

/** One of an icon's variants: the suffix it adds, under its shape. */
function Variant(props: { meta: DemoSet; icon: IconData; current: boolean; label: string }) {
  return (
    <Pressable
      testID={props.current ? "variant-current" : `sibling-${props.icon.name}`}
      selected={props.current}
      onPress={() => openIcon(props.meta, props.icon.name)}
      class={`min-w-16 items-center gap-1 rounded-lg border p-2 ${props.current ? "border-primary/40 bg-primary/10" : "border-border bg-card hover:bg-muted active:bg-muted"} ${focus}`}
    >
      <Icon icon={props.icon} size={20} color={token("foreground")} />
      <Text class={`text-center text-xs ${props.current ? "text-primary" : "text-muted-foreground"}`}>{props.label}</Text>
    </Pressable>
  );
}

/** The icon the grid or a search result picked: its preview, its code, its variants. */
function Detail(props: { onClose?: () => void }) {
  return (
    <View class="min-h-0 flex-1 flex-col">
      <If when={props.onClose}>
        <View class="flex-row items-center gap-2 border-b border-border px-4 py-2">
          <Text class="flex-1 text-sm font-semibold text-foreground">Icon details</Text>
          <IconButton testID="detail-close" label="Close the icon details" onPress={props.onClose}>
            <Icon icon={lucideX} size={16} />
          </IconButton>
        </View>
      </If>
      <Scroll testID="detail" class="min-h-0 flex-1" contentClass="grow">
        <If when={activeIcon()} else={<DetailEmpty />}>
          {(current) => {
            const icon = () => current().icon;
            const meta = () => current().meta;
            return (
              <View class="gap-4 p-3">
                <View class={`h-40 items-center justify-center rounded-xl border ${previewFrame()}`}>
                  <Icon icon={icon()} size={72} color={ink()} />
                </View>
                <View class="gap-1">
                  <View class="flex-row items-center gap-1">
                    <Text testID="detail-id" class="min-w-0 flex-1 font-mono text-sm font-medium text-foreground">{`${icon().set}:${icon().name}`}</Text>
                    <IconButton testID="copy-id" size="sm" label="Copy the Iconify id" onPress={() => copy("copy-id", `${icon().set}:${icon().name}`)}>
                      <Icon icon={isCopied("copy-id") ? lucideCheck : lucideCopy} size={14} />
                    </IconButton>
                  </View>
                  <Text class="text-xs text-muted-foreground">{`${meta().name} · ${icon().viewBox[2]} × ${icon().viewBox[3]}`}</Text>
                  <License meta={meta()} />
                </View>
                <Button testID="action-export" onPress={openStudio}>
                  <Icon icon={lucideImageDown} size={16} />
                  <Text>Export…</Text>
                </Button>
                <If when={siblings().length}>
                  <View class="gap-2">
                    <Text class="text-xs font-semibold text-muted-foreground">Variants</Text>
                    <View class="flex-row flex-wrap gap-2">
                      <Variant meta={meta()} icon={icon()} current={true} label={variantLabel(icon().name)} />
                      <Each of={siblings()} key={(sibling) => sibling.name}>
                        {(sibling) => <Variant meta={meta()} icon={sibling()} current={false} label={variantLabel(sibling().name)} />}
                      </Each>
                    </View>
                  </View>
                </If>
                <CodeBlock testID="copy-ts" label="TSX" code={tsSnippet(icon())} copied={isCopied("copy-ts")} onCopy={() => copy("copy-ts", tsSnippet(icon()))} />
                <CodeBlock testID="copy-rust" label="Rust" code={rustSnippet(icon())} copied={isCopied("copy-rust")} onCopy={() => copy("copy-rust", rustSnippet(icon()))} />
                <CopyRow icon={icon()} />
              </View>
            );
          }}
        </If>
      </Scroll>
    </View>
  );
}

/** Below 1200 points wide the detail pane is a sheet over the stage. */
function DetailSheet() {
  return (
    <If when={activeIcon()}>
      {() => (
        <View class="absolute inset-0 z-40 flex-row justify-end pt-[env(safe-area-inset-top)]">
          <View testID="detail-backdrop" role="button" accessibilityLabel="Close the icon details" onPress={closeDetail} class="absolute inset-0 bg-scrim/50" />
          <View class="relative h-full w-80 flex-col border-s border-border bg-background shadow-2xl" onPress={() => {}}>
            <Detail onClose={closeDetail} />
          </View>
        </View>
      )}
    </If>
  );
}

function Stage() {
  return (
    <If when={currentSet()} else={<Browse />}>
      {(meta) => <SetView meta={meta()} />}
    </If>
  );
}

function App() {
  keymap.bind("mod+k", () => searchRef?.focus());
  keymap.bind("escape", () => {
    if (isStudioOpen()) closeStudio();
    else if (isSidebarOpen()) closeSidebar();
    else if (activeIcon()) closeDetail();
  });
  effect(() => {
    const meta = currentSet();
    if (meta) loadBodies(meta);
  });
  return (
    <View class="flex-1 flex-row bg-background pt-[env(safe-area-inset-top)] text-foreground">
      {isWeb ? <WebView ref={(node) => setDownloader(node)} html={DOWNLOADER} class="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0" /> : <View />}
      <If when={narrow()} else={<Sidebar />}>
        {() => <If when={isSidebarOpen()} else={<View />}>{() => <SidebarSheet />}</If>}
      </If>
      <View class="min-w-0 flex-1 flex-col">
        <Toolbar />
        <Stage />
      </View>
      <If when={wide() && !!currentSet()} else={<DetailSheet />}>
        {() => (
          <View class="w-96 shrink-0 flex-col border-s border-border">
            <Detail />
          </View>
        )}
      </If>
      <Studio />
      <Toaster />
    </View>
  );
}

mount(App);
