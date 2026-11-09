# Decisions

Each entry says what was chosen and why.

## SVG is the main form, fonts are an option

The libraries this follows split by platform. On the web and in Rust UI crates, icons are SVG data: react-icons, unplugin-icons, Iconify, dioxus-free-icons, icondata and leptos_icons. Icon fonts are the older path. They are what react-native-vector-icons and several Flutter packages ship. Expo is moving away from `@expo/vector-icons`, and the React Native package has split into one package per font.

NSH draws SVG natively: `svg()` turns the document into a canvas the platform draws at device pixels, and `currentColor` is the element's text color. So SVG is sharp at every size, tints from the theme, and keeps multicolor sets (logos, flags) in their own colors. A font can do none of the last.

Fonts are still useful when an app wants one file and text-like glyphs, so `nsh-icons font` builds one. It refuses icons drawn with strokes (Lucide, Tabler and most outline sets) and multicolor ones, and says to use the SVG form for those. A font holds one-color filled outlines, and turning strokes into outlines would change how the icons look.

## Every Iconify set, in two tiers

Iconify's `@iconify/json` has every set we would want, already normalized: 260 sets and about 465,000 icons in 2.2.554. Its gzipped JSON for all of them is 122 MB. A Cargo git dependency clones the whole repository, and weekly updates add to its history, so committing all of it would make every app's first build download that.

- **Bundled (35 sets, 22 MB, about 115,000 icons).** The most used UI sets, brands, logos and flags, listed in `tools/sets.ts`. Each is a Cargo feature, and `build.rs` generates typed constants only for the features an app turns on. A set left off costs nothing.
- **Everything else, through the CLI.** `nsh-icons add set:name` fetches the set's own `@iconify-json/<prefix>` package, caches it, and writes just the named icons into the app, as TS or as Rust constants. This is how unplugin-icons and shadcn work: the app holds only the icons it uses.

The CLI uses the bundled data when it runs from a checkout, so the TS and Rust forms of a bundled icon are byte for byte the same.

## Data comes from the @iconify/json tarball, pinned

`crates/nsh-icons/data/VERSION` pins the release. `tools/fetch-data.ts` downloads exactly that tarball, and CI's `data` job runs it again and fails on any difference, so the committed data is the release's. A scheduled workflow moves the pin weekly and opens a pull request. That pull request's CI compiles every bundled set from the new data, one feature at a time, so a set that stops compiling never reaches `master`.

npm tarballs over git submodules: a bump is one line plus the data diff, and npm keeps every release available.

## Generated code, not runtime parsing

Rust gets one `pub const` per icon, with the body already resolved. An alias's flips and rotations are applied as Iconify's `iconToSVG` applies them, and `ALL` is sorted for binary search. The app parses nothing at startup. A constant costs nothing until used, so the binary carries only the icons the app names.

The resolver exists twice, in Rust for `build.rs` and in TypeScript for the CLI, because a build script cannot run Node and the CLI should not need Cargo. `fixtures/transforms.json` and its expected output hold both to the same result.

## Names

Iconify's `set:name` is the id everywhere. Rust constants are the name in `SCREAMING_SNAKE` inside the set's module (`lucide::ARROW_LEFT`), with `I_` before a leading digit. CLI output prefixes the set, since one file mixes sets: `lucideArrowLeft` in TS, `LUCIDE_ARROW_LEFT` in Rust. A set whose names would collide fails generation with both names in the error, rather than dropping one.

## Licenses

The code is MIT. Each set keeps its own license, listed in `NOTICE.md` and `docs/sets.md`. Of the bundled sets, the Font Awesome, Solar, Streamline and Codicons sets are CC BY 4.0, which asks for attribution. None is copyleft. If an app enables a copyleft or non-commercial set, `build.rs` prints a Cargo warning naming its license. The CLI writes each icon's set and license beside it.

## Icon fonts get code points from U+E000 in id order

The private use area keeps glyphs from clashing with real characters. Sorting by id makes the same list give the same font and the same map. Adding an icon can move later code points, but the map is regenerated with the font, so code that uses the map's names is unaffected. `svg2ttf` gets a fixed timestamp so the bytes are stable, and CI rebuilds the gallery's font and fails if it differs.

## The gallery is an explorer, over all bundled sets, offline

`examples/gallery` shows what the library holds: every bundled set's icons, searchable, with variant chips, sibling variants, and the id, SVG, `add` command, TSX and Rust snippets an app pastes. All of it works offline, because the data ships inside the app.

NSH bundles an asset only when the app imports it as an image or a font, and both get parsed, so the bodies cannot ride along as files. `nsh-icons gallery` writes them as code instead: `src/demo-index.ts`, committed, holds each set's metadata and every icon name (3.5 MB — the whole corpus searches instantly); `src/data/<prefix>.ts`, one module per set and gitignored (85 MB together), holds the bodies in the same order, loaded by a dynamic `import()` so the bundler splits them and a set loads only when opened. CI writes `src/data/` back before checking and packaging, the same way `fetch-data.ts` owns the crate's data.

Variants are Iconify names with suffixes (`heart-fill`, `heart-duotone`), not a separate axis, so the demo derives its chips and its sibling grouping by stripping the suffixes sets actually use. `nsh.json` grants the `clipboard` capability for the copy actions; with the key present but empty, NSH would deny the clipboard.

## No local builds

As in the other SuperNSH repositories, nothing compiles on a developer's machine. CI runs formatting, Clippy and tests on three operating systems, cross-checks iOS, Android and wasm, compiles every bundled set in four shards, runs the CLI's tests under Bun, the TSX package and the gallery under `nsh test`, and on `master` packages the gallery for nine targets into the `latest` release.
