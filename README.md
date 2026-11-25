# supernsh-icons

Icons for [Native Shell](https://nsh.dev) apps, in Rust and in TSX, from every [Iconify](https://iconify.design) set: Lucide, Phosphor, Tabler, Material Symbols, Material Design Icons, Font Awesome, Heroicons, Remix, Bootstrap, Fluent, Simple Icons, logos, flags and about 250 more. That is 260 sets and roughly 465,000 icons.

- **SVG first.** Icons draw natively and stay sharp at any size. A one-color icon takes the text color, so it follows the theme. Logos and flags keep their own colors.
- **Only what you use ships.** Each of the 35 most used sets is a crate of its own, and an app's binary and bundle hold only the icons it names. Any other set's icons come one by one from the CLI.
- **One component.** `Icon` is written once, in Rust, and TSX apps import the same one.
- **Icon fonts too.** `supernsh-icons font` builds a `.ttf` of the icons you list, with a map of their code points.

`docs/sets.md` lists every set with its icon count and license. `docs/decisions.md` says why it works this way.

## Install

`supernsh-icons` draws icons and holds none. Add it, and each set the app uses:

```sh
nsh add supernsh-icons
nsh add supernsh-icons-lucide
```

That works in TSX apps and in Rust ones, where it also adds the crates to `Cargo.toml`. It needs NSH 0.7. A Rust app can use `cargo add supernsh-icons supernsh-icons-lucide` instead.

The crates have Rust in them, so a TSX app that adds them builds with the Rust toolchain, and its web build needs LLVM's `clang` and `llvm-ar`.

## Sets

The sets with a crate, `supernsh-icons-<set>`, are `akar-icons`, `ant-design`, `bi`, `bx`, `carbon`, `circle-flags`, `codicon`, `devicon`, `fa7-brands`, `fa7-regular`, `fa7-solid`, `fe`, `flag`, `fluent`, `heroicons`, `hugeicons`, `iconoir`, `ion`, `line-md`, `logos`, `lucide`, `majesticons`, `material-symbols`, `mdi`, `mingcute`, `mynaui`, `octicon`, `ph`, `radix-icons`, `ri`, `simple-icons`, `solar`, `streamline`, `svg-spinners` and `tabler`. For any other set, use the [CLI](#the-cli).

## Try the gallery

The gallery in `examples/gallery` browses every bundled set. Open it on the web at https://supernsh.github.io/icons/, or download a build of the latest `master`:

| Platform | Download |
|---|---|
| macOS (Apple silicon) | [icons-gallery-macos-arm64.zip](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-macos-arm64.zip) |
| macOS (Intel) | [icons-gallery-macos-x86_64.zip](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-macos-x86_64.zip) |
| Linux x86_64 | [icons-gallery-linux-x86_64.tar.gz](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-linux-x86_64.tar.gz) |
| Linux arm64 | [icons-gallery-linux-arm64.tar.gz](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-linux-arm64.tar.gz) |
| Windows x86_64 | [icons-gallery-windows-x86_64.zip](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-windows-x86_64.zip) |
| Windows arm64 | [icons-gallery-windows-arm64.zip](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-windows-arm64.zip) |
| iOS simulator | [icons-gallery-ios-simulator.zip](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-ios-simulator.zip) |
| Android (arm64) | [icons-gallery-android.apk](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-android.apk) |
| Web (static site) | [icons-gallery-web.tar.gz](https://github.com/SuperNSH/icons/releases/latest/download/icons-gallery-web.tar.gz) |

- **macOS:** the app is signed ad hoc, not notarized, and needs macOS 14 or later. macOS quarantines what a browser downloads, so clear that before opening it: `xattr -dr com.apple.quarantine <the unzipped .app>`.
- **iOS simulator:** an arm64 simulator build, so it needs Xcode with an iOS simulator runtime on an Apple silicon Mac. Unzip it and install it on a booted simulator with `xcrun simctl install booted <the unzipped .app>`, or drag the `.app` onto the simulator window.

## TSX

```tsx
import { Icon } from "supernsh-icons";
import { lucideHeart } from "supernsh-icons-lucide";
import { logosRust } from "supernsh-icons-logos";

<Icon icon={lucideHeart} size={20} color="#4f46e5" label="Like" />
<Icon icon={lucideHeart} class="text-primary" />
<Icon icon={logosRust} size={20} />
```

A one-color icon takes the text color around it, or `color`. Logos and flags keep their own colors. Give an icon a `label` when it stands alone; without one, screen readers skip it. A misspelled icon fails `nsh check`.

`supernsh-icons/markup` has `svgMarkup` and `svgDataUri`, and `supernsh-icons/iconify` the functions that name and resolve Iconify icons.

## Rust

```rust
use supernsh_icons::{icon, ui};
use supernsh_icons_logos as logos;
use supernsh_icons_lucide as lucide;

view()
    .child(icon(lucide::HEART).size(px(20.0)).text_color(move || theme().foreground))
    .child(ui::icon().icon(ui::IconData::from(logos::RUST)).size(20.0).label("Rust"))
```

- `icon` returns NSH's `Svg` element, so it takes any style. Give it `.accessible(true).label("Like")` when it stands alone, as a button's only content does. The element leaves out SVG masks, filters and patterns.
- `ui::icon()` is the component TSX imports. It draws the icons with masks and filters whole, which includes every circle flag.
- Each set's crate has `set::INFO` (name, license, count) and `set::ALL`, which is sorted: `supernsh_icons::find(lucide::set::ALL, "heart")`. Naming `ALL` puts the whole set in the binary.

## Moving from 0.1

| 0.1 | 0.2 |
|---|---|
| `features = ["lucide"]` | the crate `supernsh-icons-lucide` |
| `use supernsh_icons::lucide` | `use supernsh_icons_lucide as lucide` |
| `supernsh_icons::lookup("lucide:heart")` | `supernsh_icons::find(lucide::set::ALL, "heart")` |
| `supernsh-icons add lucide:heart` for a set with a crate | `import { lucideHeart } from "supernsh-icons-lucide"` |
| `svgMarkup` and `svgDataUri` from `supernsh-icons` | from `supernsh-icons/markup` |
| NSH 0.6 | NSH 0.7 |

`Icon` and `Glyph` take the props they took. An icon without a `color` now takes the text color around it. Files the CLI wrote keep working.

## The CLI

It writes the icons an app names into a file, for sets without a crate, and builds icon fonts. It is not on npm: run it from a checkout of this repository, on Node 24 or Bun, as `node cli/nsh-icons.ts`. Fonts need its libraries, so run `bun install` in `cli` first.

```sh
supernsh-icons add <set:name>... [--out src/icons.ts] [--lang ts|rust]
supernsh-icons font <set:name>... --out assets/icons.ttf [--map src/icon-font.ts] [--family NshIcons] [--lang ts|rust]
supernsh-icons gallery [--out examples/gallery] [--sets lucide,ph] [--data-only]
supernsh-icons search <text> --set <prefix>
supernsh-icons sets
```

- Ids are Iconify's, and you can browse them at [icon-sets.iconify.design](https://icon-sets.iconify.design).
- A set with a crate comes from the checkout, pinned. Any other set comes from its `@iconify-json/<prefix>` npm package and is cached under `~/.cache/supernsh-icons`. The generated file names the source and version.
- `--lang rust` writes `pub const` items of `supernsh_icons::Icon`, for icons from sets without a crate.

## Icon fonts

```sh
supernsh-icons font ph:house-fill ph:heart-fill --out assets/icons.ttf --map src/icon-font.ts
```

```tsx
import { Glyph } from "supernsh-icons";
import { phHeartFill } from "./src/icon-font"; // importing it registers the font

<Glyph glyph={phHeartFill} size={24} color="#4f46e5" label="Liked" />
```

In Rust, `--lang rust` writes `FONT` (the font's bytes) and one `supernsh_icons::Glyph` per icon. Register the font with `Root::font(FONT)` and draw a glyph with `supernsh_icons::glyph(..)`.

A font holds one-color filled outlines. The CLI refuses icons drawn with strokes, which covers Lucide, Tabler and most outline sets, and multicolor icons. Use the SVG form for those. Filled sets such as Phosphor's `-fill` icons, Material Design Icons, Material Symbols and Font Awesome work.

## Licenses

The code is MIT. Every icon set keeps its own license, listed in `NOTICE.md`. Font Awesome, Solar, Streamline and Codicons are CC BY 4.0, which asks for attribution in your app. No set with a crate is copyleft or non-commercial; `docs/sets.md` marks the ones that are.

## Layout

- `src`, `tsx`: the crate `supernsh-icons`, the components and what its TSX exports.
- `sets/<set>`: one crate per set. `src/icons.rs` and `tsx/index.ts` are generated.
- `tools`, `data`: the generator, and the pinned `@iconify/json` version it reads.
- `cli`: the command line.
- `examples`: the gallery, and an app in each language.

## What CI does

GitHub Actions does all compiling and testing:

- Formatting, Clippy and tests on Linux, macOS and Windows.
- Cross-checks for iOS, the iOS simulator, Android and wasm.
- Compiles every set's crate, builds all of them from their packages, and installs the base and two sets with `nsh add`.
- Runs the CLI's tests under Bun, and the TSX example's and the gallery's under `nsh test`.
- Draws the TSX example with AppKit and keeps the picture as an artifact.
- Checks that the committed data is the pinned release's, and that the gallery's committed files match what the CLI writes.
- On `master`, packages the gallery in `examples/gallery` for macOS, Linux and Windows on both x86_64 and arm64, plus the iOS simulator, Android and the web, and replaces the `latest` release with those nine builds (the downloads in [Try the gallery](#try-the-gallery)).
- On `master`, deploys the gallery's web build to GitHub Pages at https://supernsh.github.io/icons/ (the repository's name is the site's subpath; NSH's web build uses relative asset paths, so it serves from any).

A weekly workflow moves the pin to the newest `@iconify/json` and opens a pull request.

## The gallery

`examples/gallery` is an icon explorer over every bundled set, offline: search all 133,000 icon names at once, browse a set with variant chips (`ph`'s `-fill`, `-duotone`...), and switch an icon's sibling variants. The search lists the sets it matched with a few of the matching names, and a name opens its icon in its set. The sidebar lists the sets, the grid resizes and retints its icons (a size slider, tints, and a light or dark canvas to preview them on), and the detail pane shows the chosen icon with what an app pastes, each one button from the clipboard: the Iconify id, the SVG, the install commands, a TSX snippet or the Rust one. Below 900 points wide the sidebar is a sheet, and below 1200 the detail pane is.

Its export studio composes an icon for use as an image: a background shape, padding, and a solid or gradient fill for the background and the glyph, then saves it as SVG or as a raster (PNG or JPEG, with a quality setting) at a preset or custom size. The preview stands beside the controls that change it, and it is the file: the same markup runs the download. `supernsh-icons gallery` writes its data: the set index it commits, and one module of bodies per set, loaded when a set is opened. CI does not compare rendered pixels; to browse the icons, see [Try the gallery](#try-the-gallery).
