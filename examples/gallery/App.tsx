// The icon explorer: every bundled set's icons, searchable, with variant
// filters, sibling variants, and the snippets an app pastes. The data is
// `nsh-icons gallery`'s: src/demo-index.ts for names, src/data/ for bodies.
import { Clipboard, computed, effect, keymap, List, mount, Scroll, signal, Text, View, windowSize, type InputRef } from "nsh";
import { Button, Input, Sheet } from "nsh/base";
import { Glyph, Icon, svgMarkup, type IconData } from "nsh-icons";
import { rustName, tsName } from "nsh-icons/iconify";
import { SETS, VERSION, type DemoSet } from "./src/demo-index";
import { LAZY } from "./src/data/index";
import { phGearFill, phHeartFill, phHouseFill, phStarFill } from "./src/icon-font";

/** The variant endings sets use: each becomes a filter chip, stripped to group siblings. */
const SUFFIXES = ["bold", "bulk", "duotone", "fill", "filled", "light", "line", "outline", "regular", "rounded", "sharp", "solid", "thin", "twotone"];

const COLORS = [null, "#4f46e5", "#dc2626", "#16a34a", "#f59e0b", "#0ea5e9"];
const RESULT_CAP = 3000;

const query = signal("");
const pickedSet = signal<DemoSet | null>(null);
const suffix = signal<string | null>(null);
const active = signal<{ icon: IconData; meta: DemoSet } | null>(null);
const size = signal(28);
const color = signal<string | null>(null);
const darkGrid = signal(false);
const sidebarOpen = signal(false);
const toast = signal("");
const loadedTick = signal(0);

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
const columns = computed(() => {
  const width = windowSize().width;
  return width < 640 ? 4 : width < 900 ? 5 : width < 1280 ? 6 : 7;
});
const previewColor = () => color() ?? (darkGrid() ? "#f8fafc" : "#0f172a");
const total = SETS.reduce((sum, meta) => sum + meta.names.length, 0).toLocaleString();

let searchRef: InputRef | null = null;

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
    () => {
      toast.set(`Copied ${what}`);
      setTimeout(() => toast.set(""), 1800);
    },
    () => {
      toast.set("The clipboard said no");
      setTimeout(() => toast.set(""), 1800);
    },
  );
}

function copyActions(icon: IconData): Array<{ id: string; label: string; text: () => string }> {
  const ident = tsName(icon.set, icon.name);
  const constant = rustName(icon.set, icon.name);
  const module = icon.set.replace(/-/g, "_");
  return [
    { id: "copy-id", label: "Iconify id", text: () => `${icon.set}:${icon.name}` },
    { id: "copy-svg", label: "SVG", text: () => svgMarkup(icon) },
    { id: "copy-add", label: "add command", text: () => `nsh-icons add ${icon.set}:${icon.name} --out src/icons.ts` },
    {
      id: "copy-tsx",
      label: "TSX",
      text: () => `import { Icon } from "nsh-icons";\nimport { ${ident} } from "./src/icons";\n\n<Icon icon={${ident}} size={${size()}}${color() ? ` color="${color()}"` : ""} label="${baseName(icon.name)}" />`,
    },
    {
      id: "copy-rust",
      label: "Rust",
      text: () => `// Cargo.toml: nsh-icons = { git = "https://github.com/SuperNSH/icons", features = ["${icon.set}"] }\nuse nsh_icons::{icon, ${module}};\n\nicon(${module}::${constant}).size(px(${size()}.0))`,
    },
  ];
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
        <Text class="line-clamp-2 text-xs text-muted-foreground">nsh-icons font builds the .ttf; importing its map registers it.</Text>
      </View>
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
          placeholder={`Search ${total} icons (name or variant)`}
          class="rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground"
        />
      </View>
      <View class="flex-row items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1">
        <Button testID="size-down" onPress={() => size.update((n) => Math.max(16, n - 4))} class="rounded px-2 py-0.5 text-sm text-foreground">
          −
        </Button>
        <Text class="w-8 text-center text-xs text-muted-foreground">{`${size()}px`}</Text>
        <Button testID="size-up" onPress={() => size.update((n) => Math.min(64, n + 4))} class="rounded px-2 py-0.5 text-sm text-foreground">
          +
        </Button>
      </View>
      <View class="flex-row items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1.5">
        <Each of={COLORS}>
          {(swatch) => (
            <Button
              testID={`color-${swatch() ?? "auto"}`}
              onPress={() => color.set(swatch())}
              selected={color() === swatch()}
              accessibilityLabel={swatch() ? `Tint ${swatch()}` : "Automatic tint"}
              class={`size-5 items-center justify-center rounded-full border ${color() === swatch() ? "border-primary ring-2 ring-ring" : "border-border"}`}
            >
              <View class="size-3.5 rounded-full" style={{ backgroundColor: swatch() ?? undefined }} />
            </Button>
          )}
        </Each>
      </View>
      <Button testID="dark" onPress={() => darkGrid.update((dark) => !dark)} class="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground">
        {darkGrid() ? "Light grid" : "Dark grid"}
      </Button>
      {narrow() ? (
        <Button testID="sets-button" onPress={() => sidebarOpen.set(true)} class="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground">
          Sets
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
        class={`rounded-full border px-2.5 py-1 text-xs ${!suffix() ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
      >
        All
      </Button>
      <Each of={suffixCounts()}>
        {(chip) => (
          <Button
            testID={`suffix-${chip().token}`}
            onPress={() => suffix.set(chip().token)}
            class={`rounded-full border px-2.5 py-1 text-xs ${suffix() === chip().token ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {`${chip().token} ${chip().count}`}
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
              class={`items-center gap-1.5 rounded-lg border p-2 ${darkGrid() ? "border-slate-700 bg-slate-900" : "border-border bg-card"}`}
            >
              {row().icon ? (
                <Icon icon={row().icon!} size={size()} color={row().icon!.multicolor ? undefined : previewColor()} label={row().name} />
              ) : (
                <View style={{ height: size(), width: size() }} />
              )}
              <Text class={`line-clamp-1 w-full text-center text-[10px] ${darkGrid() ? "text-slate-400" : "text-muted-foreground"}`}>{row().name}</Text>
            </Button>
          )}
        </List>
      )}
    </Each>
  );
}

function Home() {
  return (
    <Each of={[columns()]}>
      {(count) => (
        <List testID="home" each={SETS} numColumns={Math.max(2, count() - 2)} estimatedItemSize={130} contentClass="gap-2 p-2" class="flex-1">
          {(meta) => (
            <Button testID={`card-${meta().prefix}`} onPress={() => openSet(meta())} class="gap-2 rounded-lg border border-border bg-card p-3">
              <View class="flex-row gap-2">
                <Each of={meta().samples}>
                  {(sample) => <Icon icon={sample()} size={22} color={meta().multicolor ? undefined : previewColor()} />}
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

function Detail() {
  return (
    <Scroll testID="detail" class="w-80 shrink-0 border-l border-border">
      <View class="gap-4 p-4">
        <Each of={activeList()}>
          {(current) => (
            <View class="gap-4">
              <View class={`items-center rounded-xl border p-6 ${darkGrid() ? "border-slate-700 bg-slate-900" : "border-border bg-card"}`}>
                <Icon icon={current().icon} size={96} color={current().icon.multicolor ? undefined : previewColor()} label={current().icon.name} />
              </View>
              <View class="gap-1">
                <Text testID="detail-id" class="font-mono text-sm font-medium text-foreground">{`${current().icon.set}:${current().icon.name}`}</Text>
                <Text class="line-clamp-1 text-xs text-muted-foreground">{`${current().meta.name} · ${current().meta.license}${current().meta.restrictive ? " (asks attribution or limits use)" : ""}`}</Text>
                <Text class="text-xs text-muted-foreground">{`${current().icon.viewBox[2]} × ${current().icon.viewBox[3]}${current().icon.multicolor ? " · multicolor" : ""}`}</Text>
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
              <View class="gap-1.5">
                <Each of={copyActions(current().icon)}>
                  {(action) => (
                    <Button
                      testID={action().id}
                      onPress={() => copied(action().label, action().text())}
                      class="flex-row items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <Text class="text-sm text-foreground">{`Copy ${action().label}`}</Text>
                      <Text class="line-clamp-1 max-w-40 text-xs text-muted-foreground">{action().text().split("\n")[0].replace(/<[^>]*>/g, "").slice(0, 36)}</Text>
                    </Button>
                  )}
                </Each>
              </View>
            </View>
          )}
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
      {narrow() ? (
        <Sheet open={active() !== null} side="right" onOpenChange={(event) => !event.open && active.set(null)}>
          <Detail />
        </Sheet>
      ) : (
        <Detail />
      )}
      {toast() ? (
        <View class="absolute bottom-4 right-4 rounded-lg bg-primary px-3 py-2 shadow-lg">
          <Text class="text-sm text-primary-foreground">{toast()}</Text>
        </View>
      ) : (
        <View />
      )}
    </View>
  );
}

mount(App);
