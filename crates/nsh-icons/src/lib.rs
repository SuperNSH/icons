//! Icons for Native Shell apps: every bundled Iconify set as typed SVG
//! constants, one Cargo feature per set, and icon-font glyphs.
//!
//! ```toml
//! nsh-icons = { git = "https://github.com/SuperNSH/icons", features = ["lucide"] }
//! ```
//!
//! ```ignore
//! use nsh_icons::{icon, lucide};
//! icon(lucide::HEART).size(px(20.0)).text_color(move || theme().foreground)
//! ```
//!
//! A monotone icon draws in `currentColor`, the element's text color, so it
//! follows the theme. Sets outside the bundled ones, and icon fonts, come
//! from the `nsh-icons` CLI in `packages/nsh-icons`.

use nsh_core::element::ImageSrc;
use nsh_core::prelude::*;

include!(concat!(env!("OUT_DIR"), "/sets.rs"));

/// One icon: its SVG body and view box, from a bundled set.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Icon {
    /// The set's prefix, such as `lucide`.
    pub set: &'static str,
    /// The icon's Iconify name, such as `arrow-left`.
    pub name: &'static str,
    /// The SVG content inside `<svg>`.
    pub body: &'static str,
    /// `left top width height`.
    pub view_box: [f32; 4],
    /// Drawn in its own colors (logos, flags, emoji); `currentColor` does
    /// not tint it.
    pub multicolor: bool,
}

impl Icon {
    /// The width it lays out at when nothing sizes it, from its view box.
    pub fn width(&self) -> f32 {
        self.view_box[2]
    }

    /// The height it lays out at when nothing sizes it.
    pub fn height(&self) -> f32 {
        self.view_box[3]
    }

    /// `set:name`, Iconify's id for it.
    pub fn id(&self) -> String {
        format!("{}:{}", self.set, self.name)
    }

    /// The whole SVG document.
    pub fn markup(&self) -> String {
        let [left, top, width, height] = self.view_box;
        format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {width} {height}" width="{width}" height="{height}">{}</svg>"#,
            self.body
        )
    }
}

/// What a bundled set is, from its Iconify info.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct IconSet {
    pub prefix: &'static str,
    pub name: &'static str,
    /// SPDX id where the set gives one. Ship a set's icons on its terms.
    pub license: &'static str,
    pub author: &'static str,
    pub multicolor: bool,
    pub total: usize,
}

/// The icon named `name` in one set's `set::ALL`, which is sorted by name.
pub fn find(icons: &[Icon], name: &str) -> Option<Icon> {
    icons
        .binary_search_by(|icon| icon.name.cmp(name))
        .ok()
        .map(|at| icons[at])
}

/// The icon an Iconify id (`set:name`) names, among the sets turned on.
/// Prefer the constants: a lookup by string keeps nothing out of the
/// binary that the set's feature has not already put in.
pub fn lookup(id: &str) -> Option<Icon> {
    let (set, name) = id.split_once(':')?;
    SETS.iter()
        .find(|(info, _)| info.prefix == set)
        .and_then(|(_, icons)| find(icons, name))
}

/// The icon as an element, at its view box's size until styled. Chain
/// `.size(..)` and `.text_color(..)`; give it `.accessible(true).label(..)`
/// when it stands alone, as a button's only content does.
pub fn icon(icon: Icon) -> Svg {
    svg(ImageSrc::svg_markup(&icon.markup()))
}

/// A glyph of an icon font the CLI made (`nsh-icons font`): register the
/// font with `Root::font` (Rust) or by importing the `.ttf` (TSX).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Glyph {
    /// The font's family name.
    pub family: &'static str,
    /// The private-use code point the CLI gave the icon.
    pub codepoint: char,
}

/// The glyph as text in its font, colored and sized as text is.
pub fn glyph(glyph: Glyph) -> Text {
    text(glyph.codepoint.to_string()).font_family(glyph.family)
}
