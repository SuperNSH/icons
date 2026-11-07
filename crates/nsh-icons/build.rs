//! Generates `$OUT_DIR/sets.rs`: one module for each set the app turns on
//! with a Cargo feature, and `SETS`, the list of them. Sets left off cost
//! nothing; their data is never read.

use std::{env, fmt::Write as _, fs, path::PathBuf};

fn main() {
    let dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("data/sets");
    println!("cargo:rerun-if-changed=data/sets");
    let mut files: Vec<PathBuf> = fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("{}: {e}", dir.display()))
        .map(|entry| entry.unwrap().path())
        .collect();
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
                "cargo:warning=nsh-icons: the `{prefix}` set is {license}; an app that ships its icons takes on those terms"
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
        .map(|m| format!("({m}::SET, {m}::ALL)"))
        .collect();
    let _ = writeln!(
        out,
        "pub const SETS: &[(IconSet, &[Icon])] = &[{}];",
        list.join(", ")
    );
    let target = PathBuf::from(env::var("OUT_DIR").unwrap()).join("sets.rs");
    fs::write(&target, out).unwrap_or_else(|e| panic!("{}: {e}", target.display()));
}
