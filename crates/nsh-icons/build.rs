//! Generates `$OUT_DIR/sets.rs`: one module for each set the app turns on
//! with a Cargo feature, and `SETS`, the list of them. Sets left off cost
//! nothing; their data is never read.

use std::{env, fmt::Write as _, fs, path::PathBuf};

fn main() {
    let mut files = Vec::new();
    for dir in set_dirs() {
        println!("cargo:rerun-if-changed={}", dir.display());
        let entries = fs::read_dir(&dir).unwrap_or_else(|e| panic!("{}: {e}", dir.display()));
        files.extend(entries.map(|entry| entry.unwrap().path()));
    }
    files.sort();

    let mut out = String::new();
    let mut enabled = Vec::new();
    for path in files {
        let Some(prefix) = path
            .file_name()
            .and_then(|n| n.to_str())
            .and_then(|n| n.strip_suffix(".json.gz"))
        else {
            continue;
        };
        let feature = format!("CARGO_FEATURE_{}", prefix.to_uppercase().replace('-', "_"));
        if env::var_os(&feature).is_none() {
            continue;
        }
        let module = nsh_icons_codegen::module_from_file(&path)
            .unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        if let Some(license) = nsh_icons_codegen::restrictive_license(&module) {
            println!(
                "cargo:warning=supernsh-icons: the `{prefix}` set is {license}; an app that ships its icons takes on those terms"
            );
        }
        out.push_str(&module);
        enabled.push(nsh_icons_codegen::module_name(prefix));
    }
    let _ = writeln!(
        out,
        "/// Every set turned on with a Cargo feature, with its icons."
    );
    let list: Vec<String> = enabled
        .iter()
        .map(|m| format!("({m}::set::INFO, {m}::set::ALL)"))
        .collect();
    let _ = writeln!(
        out,
        "pub const SETS: &[(IconSet, &[Icon])] = &[{}];",
        list.join(", ")
    );
    let target = PathBuf::from(env::var("OUT_DIR").unwrap()).join("sets.rs");
    fs::write(&target, out).unwrap_or_else(|e| panic!("{}: {e}", target.display()));
}

/// The repository's own sets, or in a published crate those of the data crates turned on. The
/// data crates link to the repository's files, and a Windows checkout has no links.
fn set_dirs() -> Vec<PathBuf> {
    let local = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("data/sets");
    if local.is_dir() {
        return vec![local];
    }
    let dirs: &[&str] = &[
        #[cfg(feature = "data-1")]
        supernsh_icons_data_1::DIR,
        #[cfg(feature = "data-2")]
        supernsh_icons_data_2::DIR,
        #[cfg(feature = "data-3")]
        supernsh_icons_data_3::DIR,
    ];
    dirs.iter().map(PathBuf::from).collect()
}
