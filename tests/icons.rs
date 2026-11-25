//! The constants, the elements and the components, with two of the sets.

use std::time::{Duration, SystemTime};

use nsh_core::prelude::*;
use nsh_engine::{Clock, EngineConfig, Root};
use nsh_testing::Headless;
use supernsh_icons::ui::{GlyphData, IconData};
use supernsh_icons::{Glyph, find, icon, ui};
use supernsh_icons_logos as logos;
use supernsh_icons_lucide as lucide;

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
    for (info, icons) in [
        (lucide::set::INFO, lucide::set::ALL),
        (logos::set::INFO, logos::set::ALL),
    ] {
        assert!(
            icons.windows(2).all(|w| w[0].name < w[1].name),
            "{} is not sorted",
            info.prefix
        );
        assert_eq!(icons.len(), info.total);
    }
    assert_eq!(find(lucide::set::ALL, "heart"), Some(lucide::HEART));
    assert_eq!(find(lucide::set::ALL, "no-such-icon"), None);
}

#[test]
fn tsx_gets_both_components_documented() {
    let registry = supernsh_icons::registry();
    assert_eq!(registry.specifier(), Some("supernsh-icons"));
    assert_eq!(registry.undocumented(), Vec::<String>::new());
    let types = nsh_core::element::declarations(&registry, &[]);
    for line in [
        "export declare const Icon: ((props: IconProps) => JSX.Element);",
        "export declare const Glyph: ((props: GlyphProps) => JSX.Element);",
        "  icon: IconData;",
        "  glyph: GlyphData;",
    ] {
        assert!(types.contains(line), "missing {line:?} in\n{types}");
    }
}

/// A circle flag's shape: a mask cuts the square to a circle.
fn masked_flag() -> IconData {
    IconData {
        set: "fixture".into(),
        name: "flag".into(),
        body: r##"<mask id="m"><circle cx="8" cy="8" r="8" fill="#fff"/></mask><g mask="url(#m)"><path fill="#c00" d="M0 0h16v16H0z"/></g>"##.into(),
        view_box: vec![0.0, 0.0, 16.0, 16.0],
        multicolor: true,
    }
}

#[component]
fn IconScreen() -> impl IntoElement {
    let star = Glyph {
        family: "Icons",
        codepoint: '\u{e000}',
    };
    view()
        .child(
            icon(lucide::HEART)
                .size(px(20.0))
                .accessible(true)
                .label("Element"),
        )
        .child(
            ui::icon()
                .icon(IconData::from(lucide::HEART))
                .size(20.0)
                .label("Component"),
        )
        .child(ui::icon().icon(IconData::from(logos::RUST)))
        .child(ui::glyph().glyph(GlyphData::from(star)).label("Star"))
        .child(
            ui::icon()
                .icon(masked_flag())
                .label("Masked")
                .test_id("masked"),
        )
        .child(supernsh_icons::glyph(star))
        .child(text("ready"))
}

#[test]
fn the_element_and_the_components_mount_with_their_labels() -> Result<(), String> {
    let config = EngineConfig {
        clock: Clock::manual(SystemTime::UNIX_EPOCH),
        ..EngineConfig::new(Root::of::<IconScreen>())
    };
    let mut app = Headless::start(config).map_err(|e| format!("the engine did not start: {e}"))?;
    app.wait_for("text:ready").map_err(|e| e.to_string())?;
    for label in ["Element", "Component", "Star", "Masked"] {
        app.wait_until(label, Duration::from_secs(1), |screen| {
            screen.count(&format!("label:{label}")) == Ok(1)
        })
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
