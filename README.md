# nsh-icons

Icons for [Native Shell](https://nsh.dev) apps, in Rust and in TSX, from every [Iconify](https://iconify.design) set: Lucide, Phosphor, Tabler, Material Symbols, Material Design Icons, Font Awesome, Heroicons, Remix, Bootstrap, Fluent, Simple Icons, logos, flags and about 250 more. That is 260 sets and roughly 465,000 icons.

- **SVG first.** Icons draw natively and stay sharp at any size. A one-color icon takes the text color, so it follows the theme. Logos and flags keep their own colors.
- **Only what you use ships.** Rust turns on one Cargo feature per set, and only the icons you name end up in the binary. TSX apps get a generated file holding just the icons they asked for.
- **Icon fonts too.** `nsh-icons font` builds a `.ttf` of the icons you list, with a map of their code points.

`docs/sets.md` lists every set with its icon count and license. `docs/decisions.md` says why it works this way.

## Rust

35 popular sets are bundled. Turn on the ones you use:

```toml
[dependencies]
nsh-icons = { git = "https://github.com/SuperNSH/icons", features = ["lucide", "logos"] }
```

```rust
use nsh_icons::{icon, logos, lucide};

view()
    .child(icon(lucide::HEART).size(px(20.0)).text_color(move || theme().foreground))
    .child(icon(logos::RUST).size(px(20.0)))
```

`icon` returns NSH's `Svg` element, so it takes any style. Give it `.accessible(true).label("Like")` when it stands alone, as a button's only content does. Each set's module has `set::INFO` (name, license, count) and `set::ALL`, which is sorted. `nsh_icons::lookup("lucide:heart")` finds an icon by its Iconify id among the sets you turned on.

The bundled sets are `akar-icons`, `ant-design`, `bi`, `bx`, `carbon`, `circle-flags`, `codicon`, `devicon`, `fa7-brands`, `fa7-regular`, `fa7-solid`, `fe`, `flag`, `fluent`, `heroicons`, `hugeicons`, `iconoir`, `ion`, `line-md`, `logos`, `lucide`, `majesticons`, `material-symbols`, `mdi`, `mingcute`, `mynaui`, `octicon`, `ph`, `radix-icons`, `ri`, `simple-icons`, `solar`, `streamline`, `svg-spinners` and `tabler`. For any other set, use the CLI with `--lang rust`, below.

## TSX

Add the package from `packages/nsh-icons` to the app's `node_modules`, then write the icons you use into a file:

```sh
npx nsh-icons add lucide:heart ph:star-fill logos:github-icon --out src/icons.ts
```

```tsx
import { Icon } from "nsh-icons";
import { lucideHeart } from "./src/icons";

<Icon icon={lucideHeart} size={20} color="#4f46e5" label="Like" />
```

Running `add` again with more ids adds them to the file. The first line of the file lists what it holds.

## The CLI

It runs on Node 24 or Bun.

```sh
nsh-icons add <set:name>... [--out src/icons.ts] [--lang ts|rust]
nsh-icons font <set:name>... --out assets/icons.ttf [--map src/icon-font.ts] [--family NshIcons] [--lang ts|rust]
nsh-icons search <text> --set <prefix>
nsh-icons sets
```

- Ids are Iconify's, and you can browse them at [icon-sets.iconify.design](https://icon-sets.iconify.design).
- A bundled set comes from the repository's pinned data. Any other set comes from its `@iconify-json/<prefix>` npm package and is cached under `~/.cache/nsh-icons`. The generated file names the source and version.
- `--lang rust` writes `pub const` items of `nsh_icons::Icon`, for icons from sets the crate does not bundle.

## Icon fonts

```sh
nsh-icons font ph:house-fill ph:heart-fill --out assets/icons.ttf --map src/icon-font.ts
```

```tsx
import { Glyph } from "nsh-icons";
import { phHeartFill } from "./src/icon-font"; // importing it registers the font

<Glyph glyph={phHeartFill} size={24} color="#4f46e5" label="Liked" />
```

In Rust, `--lang rust` writes `FONT` (the font's bytes) and one `nsh_icons::Glyph` per icon. Register the font with `Root::font(FONT)` and draw a glyph with `nsh_icons::glyph(..)`.

A font holds one-color filled outlines. The CLI refuses icons drawn with strokes, which covers Lucide, Tabler and most outline sets, and multicolor icons. Use the SVG form for those. Filled sets such as Phosphor's `-fill` icons, Material Design Icons, Material Symbols and Font Awesome work.

## Licenses

The code is MIT. Every icon set keeps its own license, listed in `NOTICE.md`. Font Awesome, Solar, Streamline and Codicons are CC BY 4.0, which asks for attribution in your app. A copyleft or non-commercial set prints a Cargo warning when you turn it on.

## What CI does

GitHub Actions does all compiling and testing:

- Formatting, Clippy and tests on Linux, macOS and Windows.
- Cross-checks for iOS, the iOS simulator, Android and wasm.
- Compiles every bundled set's generated module.
- Runs the CLI's tests under Bun and the TSX package's tests under `nsh test`.
- Checks that the committed data is the pinned release's.
- On `master`, packages the gallery in `examples/gallery` for macOS, Linux and Windows on both x86_64 and arm64, plus the iOS simulator, Android and the web, into the `latest` release.
- On `master`, deploys the gallery's web build to GitHub Pages at https://supernsh.github.io/nsh-icons/ (NSH's web build uses relative asset paths, so it serves from that subpath).

A weekly workflow moves the pin to the newest `@iconify/json` and opens a pull request.

The tests check the generated code, the element mounting with its label, and the TSX screen. CI does not compare rendered pixels, so to see the icons, open a gallery build from the release.
