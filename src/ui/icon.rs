use nsh_core::element::ImageSrc;
use nsh_core::prelude::*;

/// One icon as a set's TSX module or `supernsh-icons add` writes it.
#[derive(Debug, Clone, Default, PartialEq, JsObject)]
pub struct IconData {
    /// The set's prefix, such as `lucide`.
    pub set: SharedString,
    /// The icon's Iconify name, such as `arrow-left`.
    pub name: SharedString,
    /// The SVG content inside `<svg>`.
    pub body: SharedString,
    /// `[left, top, width, height]`.
    pub view_box: Vec<f32>,
    /// Drawn in its own colors (logos, flags, emoji); the text color does
    /// not tint it.
    pub multicolor: bool,
}

impl IconData {
    /// NSH's `svg` element leaves these out: what they apply to draws whole.
    fn needs_image(&self) -> bool {
        ["<mask", "<filter", "<pattern"]
            .iter()
            .any(|tag| self.body.contains(tag))
    }

    fn src(&self) -> ImageSrc {
        ImageSrc::svg_markup(&crate::markup(&self.body, self.view_box()))
    }

    /// A box of another length, which JS can pass, draws as 16 by 16.
    fn view_box(&self) -> [f32; 4] {
        self.view_box
            .as_slice()
            .try_into()
            .unwrap_or([0.0, 0.0, 16.0, 16.0])
    }
}

impl From<crate::Icon> for IconData {
    fn from(icon: crate::Icon) -> Self {
        Self {
            set: icon.set.into(),
            name: icon.name.into(),
            body: icon.body.into(),
            view_box: icon.view_box.to_vec(),
            multicolor: icon.multicolor,
        }
    }
}

/// The props of [`Icon`].
#[derive(Debug, Clone, PartialEq, Props)]
pub struct IconProps {
    /// The icon: an export of a set's module, or of a file the CLI wrote.
    pub icon: Prop<IconData>,
    /// Its height in points; the width keeps the icon's aspect ratio.
    #[prop(default = 24.0)]
    pub size: Prop<f32>,
    /// The tint of a monotone icon; left out, the text color around it.
    /// A multicolor icon keeps its own colors.
    pub color: Prop<Option<Hsla>>,
    /// What a screen reader says. Leave it out when text beside it says the
    /// same: the icon is then decorative.
    pub label: Prop<Option<SharedString>>,
}

/// An icon drawn sharp at any size, in the text color around it.
#[component]
pub fn Icon(props: IconProps) -> impl IntoElement {
    let IconProps {
        icon,
        size,
        color,
        label,
    } = props;
    view()
        .w(move || {
            let [_, _, width, height] = icon.with(|icon| icon.view_box());
            px(size.get() * width / height)
        })
        .h(move || px(size.get()))
        .flex_shrink_0()
        .accessible(move || label.get().is_some())
        .accessibility_elements_hidden(move || label.get().is_none())
        .role(AccessibilityRole::Image)
        .label(move || label.get().unwrap_or_default())
        .child(
            when(
                move || icon.with(|icon| icon.needs_image()),
                move || {
                    image(move || icon.with(|icon| icon.src()))
                        .size_full()
                        .style_with(move |style| {
                            // An image has no text color to take, so a
                            // monotone one without a color is the theme's.
                            let tint = match color.get() {
                                _ if icon.with(|icon| icon.multicolor) => None,
                                Some(color) => Some(color.into()),
                                None => tokens().color("foreground"),
                            };
                            match tint {
                                Some(tint) => style.tint_color(tint),
                                None => style,
                            }
                        })
                },
            )
            .otherwise(move || {
                svg(move || icon.with(|icon| icon.src()))
                    .size_full()
                    .style_with(move |style| match color.get() {
                        Some(color) => style.text_color(color),
                        None => style,
                    })
            }),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_body(body: &'static str) -> IconData {
        IconData {
            body: body.into(),
            ..IconData::default()
        }
    }

    #[test]
    fn only_what_the_svg_element_leaves_out_is_an_image() {
        assert!(with_body(r#"<mask id="m"/><g mask="url(#m)"/>"#).needs_image());
        assert!(with_body(r#"<filter id="f"/>"#).needs_image());
        assert!(with_body(r#"<pattern id="p"/>"#).needs_image());
        assert!(!with_body(r#"<path fill="currentColor"/>"#).needs_image());
        assert!(!with_body(r#"<linearGradient id="g"/>"#).needs_image());
    }

    #[test]
    fn a_box_of_another_length_is_sixteen_by_sixteen() {
        assert_eq!(IconData::default().view_box(), [0.0, 0.0, 16.0, 16.0]);
    }
}
