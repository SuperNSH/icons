//! The shared fixture in `fixtures/`: the TypeScript resolver reads the same
//! files, so both languages give the same body and view box for each icon.

use std::path::Path;

use serde_json::Value;

#[test]
fn transforms_match_the_shared_expectations() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures");
    let input = std::fs::read_to_string(dir.join("transforms.json")).unwrap();
    let expected: Value = serde_json::from_str(
        &std::fs::read_to_string(dir.join("transforms.expected.json")).unwrap(),
    )
    .unwrap();

    let (info, icons) = nsh_icons_codegen::parse(&input).unwrap();
    assert_eq!(info.prefix, "fixture");
    assert_eq!(info.license, "MIT");
    let expected = expected.as_array().unwrap();
    assert_eq!(icons.len(), expected.len());
    for (icon, want) in icons.iter().zip(expected) {
        assert_eq!(icon.name, want["name"].as_str().unwrap());
        assert_eq!(icon.body, want["body"].as_str().unwrap(), "{}", icon.name);
        let view_box: Vec<f64> = want["viewBox"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_f64().unwrap())
            .collect();
        assert_eq!(icon.view_box.to_vec(), view_box, "{}", icon.name);
    }
}
