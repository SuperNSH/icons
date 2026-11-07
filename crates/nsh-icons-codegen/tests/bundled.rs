//! Every bundled set generates: no broken alias, no two names becoming one
//! identifier. This reads the real data, so an upstream bump that breaks a
//! set fails here before any app compiles it.

use std::path::Path;

#[test]
fn every_bundled_set_generates_a_module() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../nsh-icons/data/sets");
    let mut sets = 0;
    let mut icons = 0;
    for entry in std::fs::read_dir(&dir).unwrap() {
        let path = entry.unwrap().path();
        let text = nsh_icons_codegen::read_gzipped(&path).unwrap();
        let (info, resolved) =
            nsh_icons_codegen::parse(&text).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        let module = nsh_icons_codegen::module(&info, &resolved, resolved.len())
            .unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        assert!(module.contains("pub const ALL"), "{}", path.display());
        assert!(!resolved.is_empty(), "{} has no icons", path.display());
        sets += 1;
        icons += resolved.len();
    }
    assert!(sets >= 35, "expected the 35 bundled sets, found {sets}");
    assert!(icons > 100_000, "expected over 100k icons, found {icons}");
}
