use nsh_core::prelude::*;

/// One glyph of a font `supernsh-icons font` made.
#[derive(Debug, Clone, Default, PartialEq, JsObject)]
pub struct GlyphData {
    /// The font's family name: the default export of its `.ttf` import.
    pub family: SharedString,
    /// The private-use code point the CLI gave the icon.
    pub codepoint: u32,
}

impl From<crate::Glyph> for GlyphData {
    fn from(glyph: crate::Glyph) -> Self {
        Self {
            family: glyph.family.into(),
            codepoint: glyph.codepoint.into(),
        }
    }
}

/// The props of [`Glyph`].
#[derive(Debug, Clone, PartialEq, Props)]
pub struct GlyphProps {
    /// The glyph: an export of the map `supernsh-icons font` wrote.
    pub glyph: Prop<GlyphData>,
    /// Its font size in points.
    #[prop(default = 24.0)]
    pub size: Prop<f32>,
    /// Its color; left out, the text color around it.
    pub color: Prop<Option<Hsla>>,
    /// What a screen reader says. Leave it out when text beside it says the
    /// same: the glyph is then decorative.
    pub label: Prop<Option<SharedString>>,
}

/// An icon-font glyph, laid out as text and colored as text is.
#[component]
pub fn Glyph(props: GlyphProps) -> impl IntoElement {
    let GlyphProps {
        glyph,
        size,
        color,
        label,
    } = props;
    text(move || {
        char::from_u32(glyph.get().codepoint)
            .map(String::from)
            .unwrap_or_default()
    })
    .font_family(move || glyph.get().family)
    .text_size(move || px(size.get()))
    .style_with(move |style| match color.get() {
        Some(color) => style.text_color(color),
        None => style,
    })
    .accessible(move || label.get().is_some())
    .accessibility_elements_hidden(move || label.get().is_none())
    .label(move || label.get().unwrap_or_default())
}
