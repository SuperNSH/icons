//! Icons for Native Shell apps, in Rust and in TSX: an [`Icon`] type, the
//! components that draw icons and icon-font glyphs, and one crate per
//! Iconify set (`supernsh-icons-lucide`, `supernsh-icons-logos`, ...).
//!
//! ```ignore
//! use supernsh_icons::icon;
//! use supernsh_icons_lucide as lucide;
//!
//! icon(lucide::HEART).size(px(20.0)).text_color(move || theme().foreground)
//! ```
//!
//! A monotone icon draws in `currentColor`, the element's text color, so it
//! follows the theme. Sets without a crate, and icon fonts, come from the
//! `supernsh-icons` CLI in the repository's `cli` folder.

pub mod ui;

use nsh_core::element::ImageSrc;
use nsh_core::prelude::*;

/// One icon: its SVG body and view box, from a set's crate or the CLI.
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
    /// Drawn in its own colors (logos, flags, emoji); the text color does
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
        markup(self.body, self.view_box)
    }
}

/// What a set is, from its Iconify info: `set::INFO` in its crate.
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
/// Prefer the constants: `ALL` puts the whole set in the binary.
pub fn find(icons: &[Icon], name: &str) -> Option<Icon> {
    icons
        .binary_search_by(|icon| icon.name.cmp(name))
        .ok()
        .map(|at| icons[at])
}

/// The icon as an element, at its view box's size until styled. Chain
/// `.size(..)` and `.text_color(..)`; give it `.accessible(true).label(..)`
/// when it stands alone, as a button's only content does.
///
/// The element leaves out SVG masks, filters and patterns; [`ui::icon`]
/// draws the icons that have them (every circle flag) whole.
pub fn icon(icon: Icon) -> Svg {
    svg(ImageSrc::svg_markup(&icon.markup()))
}

/// A glyph of an icon font the CLI made (`supernsh-icons font`): register the
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

fn markup(body: &str, [left, top, width, height]: [f32; 4]) -> String {
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {width} {height}" width="{width}" height="{height}">{body}</svg>"#
    )
}

/// What TSX imports from `supernsh-icons`.
#[native_module("supernsh-icons")]
fn native(registry: &mut Registry) {
    registry.register::<ui::Icon>().register::<ui::Glyph>();
}
