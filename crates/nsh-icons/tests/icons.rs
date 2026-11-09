//! The generated constants and the element, with two bundled sets on
//! (CI runs these with `--features lucide,logos`).
#![cfg(all(feature = "lucide", feature = "logos"))]

use std::time::{Duration, SystemTime};

use nsh_core::prelude::*;
use nsh_engine::{Clock, EngineConfig, Root};
use supernsh_icons::{Glyph, icon, logos, lookup, lucide};
use nsh_testing::Headless;

#[test]
fn a_constant_is_the_set_s_own_icon() {
    assert_eq!(lucide::HEART.set, "lucide");
    assert_eq!(lucide::HEART.name, "heart");
    assert_eq!(lucide::HEART.view_box, [0.0, 0.0, 24.0, 24.0]);
    assert!(lucide::HEART.body.contains("currentColor"));
    // Known at compile time, so checked there.
    const { assert!(!lucide::HEART.multicolor) };
    const { assert!(logos::RUST.multicolor) };
    assert_eq!(lucide::set::INFO.license, "ISC");
}

#[test]
fn markup_is_a_whole_svg_document() {
    let markup = lucide::HEART.markup();
    assert!(markup.starts_with(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">"#
    ));
    assert!(markup.ends_with("</svg>"));
}

#[test]
fn every_set_s_list_is_sorted_so_lookups_find_each_icon() {
    for (info, icons) in supernsh_icons::SETS {
        assert!(
            icons.windows(2).all(|w| w[0].name < w[1].name),
            "{} is not sorted",
            info.prefix
        );
        assert_eq!(icons.len(), info.total);
    }
    assert_eq!(lookup("lucide:heart"), Some(lucide::HEART));
    assert_eq!(lookup("lucide:no-such-icon"), None);
    assert_eq!(lookup("no-such-set:heart"), None);
    assert_eq!(lookup("heart"), None);
}

#[test]
fn only_the_features_turned_on_are_generated() {
    let prefixes: Vec<&str> = supernsh_icons::SETS
        .iter()
        .map(|(info, _)| info.prefix)
        .collect();
    assert_eq!(prefixes, ["logos", "lucide"]);
}

#[component]
fn IconScreen() -> impl IntoElement {
    let glyph = Glyph {
        family: "Icons",
        codepoint: '\u{e000}',
    };
    view()
        .child(
            icon(lucide::HEART)
                .size(px(20.0))
                .accessible(true)
                .label("Like"),
        )
        .child(supernsh_icons::glyph(glyph))
        .child(text("ready"))
}

#[test]
fn the_element_mounts_with_its_label() -> Result<(), String> {
    let config = EngineConfig {
        clock: Clock::manual(SystemTime::UNIX_EPOCH),
        ..EngineConfig::new(Root::of::<IconScreen>())
    };
    let mut app = Headless::start(config).map_err(|e| format!("the engine did not start: {e}"))?;
    app.wait_for("text:ready").map_err(|e| e.to_string())?;
    app.wait_until("the icon is on screen", Duration::from_secs(1), |screen| {
        screen.count("label:Like") == Ok(1)
    })
    .map_err(|e| e.to_string())?;
    Ok(())
}
