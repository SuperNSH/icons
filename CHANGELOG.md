# Changelog

## [0.2.0] - 2026-11-25

Needs NSH 0.7. The README's "Moving from 0.1" lists what to change.

### Changed

- Each of the 35 sets is a crate of its own, `supernsh-icons-<set>`, for Rust and TSX. `supernsh-icons` draws icons and holds none, and its Cargo features per set are gone. An app downloads only the sets it adds.
- `Icon` and `Glyph` are written once, in Rust, and TSX imports the same components. An icon without a `color` takes the text color around it.
- A set's Rust constants are its crate's: `supernsh_icons_lucide::HEART`. `lookup` is `find` over one set.
- `svgMarkup` and `svgDataUri` come from `supernsh-icons/markup`.

### Added

- The icons of the 35 sets for TSX, without the CLI: `import { lucideHeart } from "supernsh-icons-lucide"`.
- `supernsh_icons::ui`, the components, which draw the icons with masks, filters and patterns whole.

### Removed

- The `supernsh-icons-data-1`, `-2` and `-3` crates and `nsh-icons-codegen`: 0.1.0 is their last version.

## [0.1.0] - 2026-11-24

- First release on crates.io.
