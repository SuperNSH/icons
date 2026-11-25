# Decisions

Each entry says what was chosen and why.

## SVG is the main form, fonts are an option

The libraries this follows split by platform. On the web and in Rust UI crates, icons are SVG data: react-icons, unplugin-icons, Iconify, dioxus-free-icons, icondata and leptos_icons. Icon fonts are the older path. They are what react-native-vector-icons and several Flutter packages ship. Expo is moving away from `@expo/vector-icons`, and the React Native package has split into one package per font.

NSH draws SVG natively: `svg()` turns the document into a canvas the platform draws at device pixels, and `currentColor` is the element's text color. So SVG is sharp at every size, tints from the theme, and keeps multicolor sets (logos, flags) in their own colors. A font can do none of the last.

Fonts are still useful when an app wants one file and text-like glyphs, so `supernsh-icons font` builds one. It refuses icons drawn with strokes (Lucide, Tabler and most outline sets) and multicolor ones, and says to use the SVG form for those. A font holds one-color filled outlines, and turning strokes into outlines would change how the icons look.

## Every Iconify set, in two tiers

Iconify's `@iconify/json` has every set we would want, already normalized: 260 sets and about 465,000 icons in 2.2.554. Its gzipped JSON for all of them is 122 MB. Committing and publishing all of it would be 260 crates to keep.

- **A crate each (35 sets, about 133,000 icons).** The most used UI sets, brands, logos and flags, listed in `tools/sets.ts`.
- **Everything else, through the CLI.** `supernsh-icons add set:name` fetches the set's own `@iconify-json/<prefix>` package, caches it, and writes just the named icons into the app, as TS or as Rust constants. This is how unplugin-icons and shadcn work: the app holds only the icons it uses.

The CLI reads a set's crate when it runs from a checkout, so what it writes for such a set is byte for byte what the crate has.

## One crate per set, and a base crate that holds none

`nsh-icon`, by NSH's author, is built this way, and so is `icondata`. An app downloads only the sets it adds (Lucide is 0.3 MB), and no crate comes near crates.io's 10 MB, so nothing has to be split into numbered data crates as 0.1 was. `nsh add` takes a crate only when it has a `#[native_module]`, so each set has an empty one; its icons reach TSX as TSX, through `nsh.json`'s `exports`.

The cost is that a TSX app builds with the Rust toolchain. A TSX-only module has to come from Git instead, which clones this whole repository (over 80 MB) and would give Rust and TSX apps two different things to install.

The base crate is at the repository's root, so `nsh add github:SuperNSH/icons` works for an unreleased version of it. The sets are added by path from a checkout.

## One component, in Rust

`src/ui` has `Icon` and `Glyph` as NSH components, and `#[native_module("supernsh-icons")]` registers them for TSX. NSH writes their TypeScript declarations from the Rust, so the two languages cannot drift apart.

NSH's `svg` element draws vectors in the text color, and leaves out masks, filters and patterns. About 1,100 of the icons have one, every circle flag among them. The component draws those with `image`, whose renderer has them, tinted when they are monotone. The plain `icon` function stays a bare `Svg`, for what an app styles itself.

## Data comes from the @iconify/json tarball, pinned

`data/VERSION` pins the release. `tools/fetch-data.ts` downloads exactly that tarball, and CI's `data` job runs it again and fails on any difference, so the committed data is the release's. A scheduled workflow moves the pin weekly and opens a pull request. That pull request's CI compiles every set's crate from the new data, so a set that stops compiling never reaches `master`.

npm tarballs over git submodules: a bump is one line plus the data diff, and npm keeps every release available.

## Generated code, not runtime parsing

A set's crate has one `pub const` per icon in Rust and one export per icon in TSX, with the body already resolved. An alias's flips and rotations are applied as Iconify's `iconToSVG` applies them, and `ALL` is sorted for binary search. The app parses nothing at startup. A constant costs nothing until used, so the binary and the bundle carry only the icons the app names.

`tools/fetch-data.ts` generates both and they are committed, as text with an icon to a line: an update diffs by icon, and Git stores only what changed. 0.1 committed gzipped JSON and generated Rust in each app's build, which needed the resolver a second time in Rust.

## Names

Iconify's `set:name` is the id everywhere. Rust constants are the name in `SCREAMING_SNAKE` in the set's crate (`lucide::ARROW_LEFT`), with `I_` before a leading digit. TSX exports prefix the set (`lucideArrowLeft`), since a screen mixes sets and their names clash with each other and with NSH's own. A file the CLI wrote prefixes it in Rust too (`LUCIDE_ARROW_LEFT`).

Two names of a set can become one TSX export: `arrow-down-01` and `arrow-down-0-1`. The generator reads the exports already committed first, so a name keeps the export it has, and a newcomer that clashes is spelled out (`lucide_arrow_down_01`). Two names that become one Rust constant fail generation.

## Licenses

The code is MIT. Each set keeps its own license, listed in `NOTICE.md` and `docs/sets.md`. Of the bundled sets, the Font Awesome, Solar, Streamline and Codicons sets are CC BY 4.0, which asks for attribution. None is copyleft or non-commercial, and `docs/sets.md` marks the sets that are. Each set's crate names its license in `Cargo.toml` and carries a `NOTICE.md`. The CLI writes each icon's set and license beside it.

## Icon fonts get code points from U+E000 in id order

The private use area keeps glyphs from clashing with real characters. Sorting by id makes the same list give the same font and the same map. Adding an icon can move later code points, but the map is regenerated with the font, so code that uses the map's names is unaffected. `svg2ttf` gets a fixed timestamp so the bytes are stable, and CI rebuilds the gallery's font and fails if it differs.

## The gallery is an explorer, over all bundled sets, offline

`examples/gallery` shows what the library holds: every bundled set's icons, searchable, with variant chips, sibling variants, and the id, SVG, install commands, TSX and Rust snippets an app pastes. All of it works offline, because the data ships inside the app. It does not depend on the 35 set crates: a bundle loads a set only when it is opened, and compiling 133,000 constants for nine targets would draw nothing more.

NSH bundles an asset only when the app imports it as an image or a font, and both get parsed, so the bodies cannot ride along as files. `supernsh-icons gallery` writes them as code instead: `src/demo-index.ts`, committed, holds each set's metadata and every icon name (3.5 MB — the whole corpus searches instantly); `src/data/<prefix>.ts`, one module per set and gitignored (85 MB together), holds the bodies in the same order, loaded by a dynamic `import()` so the bundler splits them and a set loads only when opened. CI writes `src/data/` back before checking and packaging.

Variants are Iconify names with suffixes (`heart-fill`, `heart-duotone`), not a separate axis, so the demo derives its chips and its sibling grouping by stripping the suffixes sets actually use. `nsh.json` grants the `clipboard` capability for the copy actions; with the key present but empty, NSH would deny the clipboard.

A search with no set open loads no bodies: it lists the sets whose names match, with four of the names to jump to an icon by. That icon's set is the only one it loads.

## The gallery's interface is theme tokens and its own icons

The gallery's screens name tokens and nothing else: shadcn's zinc neutrals with an indigo `primary`, a `warning` for a license that asks for more, a `scrim` for what a sheet covers, and `canvas-light` and `canvas-dark` for the field an icon can be previewed on, whatever the app's appearance. All of them are in `nsh.json`'s `theme`, so the interface follows the appearance and no screen carries a palette color.

The interface's own icons (search, copy, close, sun and moon) come from `supernsh-icons-lucide`: the gallery is drawn with the library it shows.

## No local builds

As in the other SuperNSH repositories, nothing compiles on a developer's machine. CI runs formatting, Clippy and tests on three operating systems, cross-checks iOS, Android and wasm, compiles every set's crate, runs the CLI's tests under Bun and the examples' under `nsh test`, and on `master` packages the gallery for nine targets into the `latest` release.
