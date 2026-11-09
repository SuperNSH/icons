//! Turns an Iconify JSON icon set into Rust source: aliases resolved to
//! their parent's body with flips and rotations applied, names made into
//! identifiers, and one module of `Icon` constants per set. `supernsh-icons`'s
//! build script runs it for the sets an app turns on; the TypeScript CLI
//! (`packages/nsh-icons/src/iconify.ts`) does the same steps, and the shared
//! fixtures in `fixtures/` hold both to the same output.

use std::collections::{BTreeMap, HashSet};
use std::fmt::Write as _;

use serde_json::{Map, Value};

/// Alias chains deeper than this are treated as a loop.
const MAX_ALIAS_DEPTH: usize = 36;

/// One icon, ready to draw: its SVG body and its view box.
#[derive(Clone, Debug, PartialEq)]
pub struct Resolved {
    /// The Iconify name, `kebab-case`.
    pub name: String,
    /// The SVG content inside `<svg>`, transforms applied.
    pub body: String,
    /// `left top width height`.
    pub view_box: [f64; 4],
}

/// What a set says about itself, from its `info` block.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct SetInfo {
    pub prefix: String,
    pub name: String,
    pub license: String,
    pub author: String,
    pub multicolor: bool,
}

/// Why a set could not be read.
#[derive(Debug, PartialEq)]
pub enum Error {
    Json(String),
    Missing(&'static str),
    AliasLoop(String),
    UnknownParent {
        alias: String,
        parent: String,
    },
    NameCollision {
        first: String,
        second: String,
        ident: String,
    },
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Json(e) => write!(f, "invalid JSON: {e}"),
            Error::Missing(key) => write!(f, "the set has no `{key}`"),
            Error::AliasLoop(name) => write!(f, "alias `{name}` loops or nests too deep"),
            Error::UnknownParent { alias, parent } => {
                write!(
                    f,
                    "alias `{alias}` names `{parent}`, which the set does not have"
                )
            }
            Error::NameCollision {
                first,
                second,
                ident,
            } => {
                write!(f, "`{first}` and `{second}` both become `{ident}`")
            }
        }
    }
}

impl std::error::Error for Error {}

/// The transform part of an icon or alias, merged down an alias chain.
#[derive(Clone, Copy, Default)]
struct Transform {
    rotate: u8,
    h_flip: bool,
    v_flip: bool,
}

/// Reads a set: its info and every icon and alias that is not hidden,
/// sorted by name.
pub fn parse(json: &str) -> Result<(SetInfo, Vec<Resolved>), Error> {
    let root: Value = serde_json::from_str(json).map_err(|e| Error::Json(e.to_string()))?;
    let root = root.as_object().ok_or(Error::Missing("object"))?;
    let icons = root
        .get("icons")
        .and_then(Value::as_object)
        .ok_or(Error::Missing("icons"))?;
    let empty = Map::new();
    let aliases = root
        .get("aliases")
        .and_then(Value::as_object)
        .unwrap_or(&empty);

    // Set-wide defaults, which an icon's own values override.
    let defaults = [
        num(root, "left").unwrap_or(0.0),
        num(root, "top").unwrap_or(0.0),
        num(root, "width").unwrap_or(16.0),
        num(root, "height").unwrap_or(16.0),
    ];

    let mut out = Vec::new();
    for (name, icon) in icons {
        let icon = icon.as_object().ok_or(Error::Missing("icon object"))?;
        if flag(icon, "hidden") {
            continue;
        }
        out.push(resolve(name, icon, &[], defaults));
    }
    for (name, alias) in aliases {
        let alias = alias.as_object().ok_or(Error::Missing("alias object"))?;
        if flag(alias, "hidden") {
            continue;
        }
        // The chain from this alias up to the icon it ends at.
        let mut chain = vec![alias];
        let mut parent = str_of(alias, "parent").ok_or(Error::Missing("alias parent"))?;
        let icon = loop {
            if let Some(icon) = icons.get(parent).and_then(Value::as_object) {
                break icon;
            }
            let next = aliases
                .get(parent)
                .and_then(Value::as_object)
                .ok_or_else(|| Error::UnknownParent {
                    alias: name.clone(),
                    parent: parent.to_owned(),
                })?;
            if chain.len() >= MAX_ALIAS_DEPTH {
                return Err(Error::AliasLoop(name.clone()));
            }
            chain.push(next);
            parent = str_of(next, "parent").ok_or(Error::Missing("alias parent"))?;
        };
        // Applied from the icon down: the alias nearest the icon first.
        chain.reverse();
        out.push(resolve(name, icon, &chain, defaults));
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));

    let info = root.get("info").and_then(Value::as_object);
    let info_str = |key: &str| info.and_then(|i| str_of(i, key)).unwrap_or("").to_owned();
    let nested = |outer: &str, key: &str| {
        info.and_then(|i| i.get(outer))
            .and_then(Value::as_object)
            .and_then(|o| str_of(o, key))
            .unwrap_or("")
            .to_owned()
    };
    let license = match nested("license", "spdx") {
        spdx if !spdx.is_empty() => spdx,
        _ => nested("license", "title"),
    };
    let set = SetInfo {
        prefix: str_of(root, "prefix")
            .ok_or(Error::Missing("prefix"))?
            .to_owned(),
        name: info_str("name"),
        license,
        author: nested("author", "name"),
        multicolor: info.is_some_and(|i| flag(i, "palette")),
    };
    Ok((set, out))
}

/// An icon with the aliases above it merged in, as Iconify's
/// `mergeIconData` and `iconToSVG` do.
fn resolve(
    name: &str,
    icon: &Map<String, Value>,
    chain: &[&Map<String, Value>],
    defaults: [f64; 4],
) -> Resolved {
    let keys = ["left", "top", "width", "height"];
    let mut view_box = defaults;
    let mut transform = Transform::default();
    for layer in std::iter::once(icon).chain(chain.iter().copied()) {
        for (slot, key) in view_box.iter_mut().zip(keys) {
            if let Some(value) = num(layer, key) {
                *slot = value;
            }
        }
        transform.rotate = (transform.rotate + (num(layer, "rotate").unwrap_or(0.0) as u8)) % 4;
        transform.h_flip ^= flag(layer, "hFlip");
        transform.v_flip ^= flag(layer, "vFlip");
    }
    let body = str_of(icon, "body").unwrap_or("");
    let (body, view_box) = apply_transform(body, view_box, transform);
    Resolved {
        name: name.to_owned(),
        body,
        view_box,
    }
}

/// Iconify's `iconToSVG` transform step: flips become a translate and a
/// scale, rotations a `rotate` about the box's center.
fn apply_transform(
    body: &str,
    [mut left, mut top, mut width, mut height]: [f64; 4],
    t: Transform,
) -> (String, [f64; 4]) {
    let mut rotate = t.rotate;
    let mut steps: Vec<String> = Vec::new();
    if t.h_flip {
        if t.v_flip {
            rotate += 2;
        } else {
            steps.push(format!("translate({} {})", fmt(left + width), fmt(-top)));
            steps.push("scale(-1 1)".to_owned());
            top = 0.0;
            left = 0.0;
        }
    } else if t.v_flip {
        steps.push(format!("translate({} {})", fmt(-left), fmt(top + height)));
        steps.push("scale(1 -1)".to_owned());
        top = 0.0;
        left = 0.0;
    }
    match rotate % 4 {
        1 => {
            let c = height / 2.0 + top;
            steps.insert(0, format!("rotate(90 {} {})", fmt(c), fmt(c)));
        }
        2 => steps.insert(
            0,
            format!(
                "rotate(180 {} {})",
                fmt(width / 2.0 + left),
                fmt(height / 2.0 + top)
            ),
        ),
        3 => {
            let c = width / 2.0 + left;
            steps.insert(0, format!("rotate(-90 {} {})", fmt(c), fmt(c)));
        }
        _ => {}
    }
    if rotate % 2 == 1 {
        std::mem::swap(&mut left, &mut top);
        std::mem::swap(&mut width, &mut height);
    }
    let body = if steps.is_empty() {
        body.to_owned()
    } else {
        format!("<g transform=\"{}\">{body}</g>", steps.join(" "))
    };
    (body, [left, top, width, height])
}

/// A number as SVG writes it: no trailing `.0`.
pub fn fmt(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e15 {
        format!("{}", value as i64)
    } else {
        format!("{value}")
    }
}

fn num(object: &Map<String, Value>, key: &str) -> Option<f64> {
    object.get(key).and_then(Value::as_f64)
}

fn flag(object: &Map<String, Value>, key: &str) -> bool {
    object.get(key).and_then(Value::as_bool).unwrap_or(false)
}

fn str_of<'a>(object: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    object.get(key).and_then(Value::as_str)
}

const KEYWORDS: &[&str] = &[
    "as", "async", "await", "box", "break", "const", "continue", "crate", "do", "dyn", "else",
    "enum", "extern", "false", "final", "fn", "for", "gen", "if", "impl", "in", "let", "loop",
    "macro", "match", "mod", "move", "mut", "override", "priv", "pub", "ref", "return", "static",
    "struct", "super", "trait", "true", "try", "type", "typeof", "unsafe", "unsized", "use",
    "virtual", "where", "while", "yield",
];

/// A set's prefix as a module name: `fa7-solid` is `fa7_solid`.
pub fn module_name(prefix: &str) -> String {
    let ident = identifier(prefix, false);
    if KEYWORDS.contains(&ident.as_str()) {
        format!("r#{ident}")
    } else {
        ident
    }
}

/// An icon's name as a constant: `arrow-left` is `ARROW_LEFT`, `1k` is `I_1K`.
pub fn const_name(name: &str) -> String {
    identifier(name, true)
}

fn identifier(name: &str, upper: bool) -> String {
    let mut ident: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                if upper {
                    c.to_ascii_uppercase()
                } else {
                    c.to_ascii_lowercase()
                }
            } else {
                '_'
            }
        })
        .collect();
    if ident.is_empty() || ident.starts_with(|c: char| c.is_ascii_digit()) {
        ident.insert_str(0, if upper { "I_" } else { "s_" });
    }
    ident
}

/// The module text for one set: a constant per icon, and `set::INFO` and
/// `set::ALL` (sorted by name for `supernsh_icons::find`).
pub fn module(set: &SetInfo, icons: &[Resolved], total: usize) -> Result<String, Error> {
    let mut seen: BTreeMap<String, &str> = BTreeMap::new();
    for icon in icons {
        let ident = const_name(&icon.name);
        if let Some(first) = seen.insert(ident.clone(), &icon.name) {
            return Err(Error::NameCollision {
                first: first.to_owned(),
                second: icon.name.clone(),
                ident,
            });
        }
    }
    let mut out = String::new();
    let module = module_name(&set.prefix);
    let _ = writeln!(
        out,
        "/// {} ({}), by {}.",
        set.name, set.license, set.author
    );
    let _ = writeln!(out, "pub mod {module} {{");
    let _ = writeln!(out, "    use crate::Icon;");
    for icon in icons {
        let [l, t, w, h] = icon.view_box;
        let _ = writeln!(
            out,
            "    pub const {}: Icon = Icon {{ set: {:?}, name: {:?}, body: {:?}, view_box: [{}, {}, {}, {}], multicolor: {} }};",
            const_name(&icon.name),
            set.prefix,
            icon.name,
            icon.body,
            f32_lit(l),
            f32_lit(t),
            f32_lit(w),
            f32_lit(h),
            set.multicolor
        );
    }
    // A module, not constants beside the icons: an icon named `set` or `all`
    // is a constant, which lives in another namespace than a module.
    let names: Vec<String> = icons
        .iter()
        .map(|i| format!("super::{}", const_name(&i.name)))
        .collect();
    let _ = writeln!(out, "    /// The set's info and its icons, sorted by name.");
    let _ = writeln!(out, "    pub mod set {{");
    let _ = writeln!(out, "        use crate::{{Icon, IconSet}};");
    let _ = writeln!(
        out,
        "        pub const INFO: IconSet = IconSet {{ prefix: {:?}, name: {:?}, license: {:?}, author: {:?}, multicolor: {}, total: {} }};",
        set.prefix, set.name, set.license, set.author, set.multicolor, total
    );
    let _ = writeln!(
        out,
        "        pub const ALL: &[Icon] = &[{}];",
        names.join(", ")
    );
    let _ = writeln!(out, "    }}");
    let _ = writeln!(out, "}}");
    Ok(out)
}

fn f32_lit(value: f64) -> String {
    let text = fmt(value);
    if text.contains('.') {
        format!("{text}_f32")
    } else {
        format!("{text}.0_f32")
    }
}

/// Every distinct identifier a set produces, for checks over whole sets.
pub fn identifiers(icons: &[Resolved]) -> HashSet<String> {
    icons.iter().map(|i| const_name(&i.name)).collect()
}

/// Copyleft and non-commercial licenses, as `tools/fetch-data.ts` flags
/// them: a set under one puts its terms on the app that ships it.
pub fn is_restrictive(license: &str) -> bool {
    ["GPL", "LGPL", "AGPL", "CC-BY-SA", "CC-BY-NC", "MPL"]
        .iter()
        .any(|p| license.starts_with(p))
}

/// The license a generated module names, when it is a restrictive one.
pub fn restrictive_license(module: &str) -> Option<String> {
    let start = module.find("license: \"")? + "license: \"".len();
    let license = &module[start..start + module[start..].find('"')?];
    is_restrictive(license).then(|| license.to_owned())
}

/// A bundled set's file (`data/sets/<prefix>.json.gz`) as JSON text.
pub fn read_gzipped(path: &std::path::Path) -> std::io::Result<String> {
    use std::io::Read as _;
    let mut text = String::new();
    flate2::read::GzDecoder::new(std::fs::File::open(path)?).read_to_string(&mut text)?;
    Ok(text)
}

/// Generates a bundled set's module from its gzipped file.
pub fn module_from_file(path: &std::path::Path) -> Result<String, Box<dyn std::error::Error>> {
    let (info, icons) = parse(&read_gzipped(path)?)?;
    Ok(module(&info, &icons, icons.len())?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(json: &str) -> Vec<Resolved> {
        parse(json).unwrap().1
    }

    #[test]
    fn names_become_identifiers() {
        assert_eq!(const_name("arrow-left"), "ARROW_LEFT");
        assert_eq!(const_name("1k-plus"), "I_1K_PLUS");
        assert_eq!(module_name("fa7-solid"), "fa7_solid");
        assert_eq!(module_name("box"), "r#box");
        assert_eq!(module_name("4x"), "s_4x");
    }

    #[test]
    fn set_defaults_fill_an_icon_and_its_own_values_win() {
        let icons = set(r#"{"prefix":"t","width":24,"height":24,"icons":{
            "a":{"body":"<path d=\"M0\"/>"},
            "b":{"body":"<path/>","width":32}}}"#);
        assert_eq!(icons[0].view_box, [0.0, 0.0, 24.0, 24.0]);
        assert_eq!(icons[1].view_box, [0.0, 0.0, 32.0, 24.0]);
    }

    #[test]
    fn an_alias_takes_its_parents_body_with_a_flip() {
        let icons = set(r#"{"prefix":"t","width":24,"height":24,
            "icons":{"arrow":{"body":"<p/>"}},
            "aliases":{"arrow-back":{"parent":"arrow","hFlip":true}}}"#);
        let back = icons.iter().find(|i| i.name == "arrow-back").unwrap();
        assert_eq!(
            back.body,
            r#"<g transform="translate(24 0) scale(-1 1)"><p/></g>"#
        );
    }

    #[test]
    fn rotations_add_up_down_a_chain_and_swap_the_box() {
        let icons = set(r#"{"prefix":"t",
            "icons":{"a":{"body":"<p/>","width":20,"height":10}},
            "aliases":{"b":{"parent":"a","rotate":1},"c":{"parent":"b","rotate":2}}}"#);
        let c = icons.iter().find(|i| i.name == "c").unwrap();
        // 1 + 2 = 3 quarter turns about the width's center; the box swaps.
        assert_eq!(c.body, r#"<g transform="rotate(-90 10 10)"><p/></g>"#);
        assert_eq!(c.view_box, [0.0, 0.0, 10.0, 20.0]);
    }

    #[test]
    fn two_flips_are_a_half_turn() {
        let icons = set(r#"{"prefix":"t","width":16,"height":16,
            "icons":{"a":{"body":"<p/>","hFlip":true}},
            "aliases":{"b":{"parent":"a","vFlip":true}}}"#);
        let b = icons.iter().find(|i| i.name == "b").unwrap();
        assert_eq!(b.body, r#"<g transform="rotate(180 8 8)"><p/></g>"#);
    }

    #[test]
    fn hidden_icons_are_left_out_and_broken_aliases_are_errors() {
        let icons =
            set(r#"{"prefix":"t","icons":{"a":{"body":""},"old":{"body":"","hidden":true}}}"#);
        assert_eq!(icons.len(), 1);
        let err = parse(r#"{"prefix":"t","icons":{},"aliases":{"x":{"parent":"y"}}}"#).unwrap_err();
        assert_eq!(
            err,
            Error::UnknownParent {
                alias: "x".into(),
                parent: "y".into()
            }
        );
        let err =
            parse(r#"{"prefix":"t","icons":{},"aliases":{"x":{"parent":"y"},"y":{"parent":"x"}}}"#)
                .unwrap_err();
        assert_eq!(err, Error::AliasLoop("x".into()));
    }

    #[test]
    fn a_module_holds_every_icon_sorted_and_escaped() {
        let (info, icons) = parse(r##"{"prefix":"t","info":{"name":"Test","license":{"spdx":"MIT"},"author":{"name":"Ada"}},
            "icons":{"b":{"body":"<path fill=\"#fff\"/>"},"a":{"body":""}}}"##).unwrap();
        let text = module(&info, &icons, 2).unwrap();
        assert!(text.contains(r#"license: "MIT""#));
        assert!(text.contains(r##"body: "<path fill=\"#fff\"/>""##));
        assert!(text.contains("pub const ALL: &[Icon] = &[super::A, super::B];"));
        assert_eq!(restrictive_license(&text), None);
    }

    #[test]
    fn icons_named_like_the_set_s_own_items_do_not_clash() {
        let (info, icons) = parse(
            r#"{"prefix":"t","icons":{"set":{"body":""},"all":{"body":""},"info":{"body":""}}}"#,
        )
        .unwrap();
        let text = module(&info, &icons, 3).unwrap();
        assert!(text.contains("    pub const SET: Icon"));
        assert!(text.contains("pub const INFO: IconSet"));
        assert!(text.contains("pub const ALL: &[Icon] = &[super::ALL, super::INFO, super::SET];"));
    }

    #[test]
    fn copyleft_and_non_commercial_licenses_are_flagged() {
        assert!(is_restrictive("GPL-3.0-or-later"));
        assert!(is_restrictive("CC-BY-SA-4.0"));
        assert!(is_restrictive("CC-BY-NC-SA-4.0"));
        assert!(!is_restrictive("CC-BY-4.0"));
        assert!(!is_restrictive("MIT"));
    }
}
