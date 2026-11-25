//! A Rust UI drawn with the icon crates: `icon` as an element, and the `Icon`
//! component TSX apps use too.

use nsh_base::theme;
use nsh_core::element::desktop::window;
use nsh_core::prelude::*;
use supernsh_icons::{icon, ui};
use supernsh_icons_logos as logos;
use supernsh_icons_lucide as lucide;

/// The app's UI set.
#[native_module("rust-app/native")]
fn native(registry: &mut Registry) {
    registry.register::<App>();
}

/// The app's root component.
#[component]
pub fn App() -> impl IntoElement {
    let liked = signal(false);
    window().id("main").content(move || {
        view()
            .flex_1()
            .flex_row()
            .items_center()
            .justify_center()
            .gap_6()
            .bg(move || theme().background)
            .text_color(move || theme().foreground)
            .child(
                view()
                    .test_id("like")
                    .on_press(move || liked.update(|liked| *liked = !*liked))
                    .child(
                        ui::icon()
                            .icon(move || {
                                ui::IconData::from(if liked.get() {
                                    lucide::STAR
                                } else {
                                    lucide::HEART
                                })
                            })
                            .size(48.0)
                            .label(move || {
                                Some(SharedString::from(if liked.get() {
                                    "Liked"
                                } else {
                                    "Not liked"
                                }))
                            }),
                    ),
            )
            .child(
                icon(lucide::SEARCH)
                    .size(px(48.0))
                    .text_color(move || theme().primary)
                    .accessible(true)
                    .label("Search"),
            )
            .child(
                icon(logos::RUST)
                    .size(px(48.0))
                    .accessible(true)
                    .label("Rust"),
            )
    })
}
