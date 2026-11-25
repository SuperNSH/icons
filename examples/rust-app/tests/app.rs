//! The screen's icons, and the one that follows a signal.

use std::time::{Duration, SystemTime};

use nsh_engine::{Clock, EngineConfig, Root};
use nsh_testing::Headless;
use rust_app::App;

#[test]
fn the_icons_mount_and_follow_the_signal() -> Result<(), String> {
    let config = EngineConfig {
        clock: Clock::manual(SystemTime::UNIX_EPOCH),
        ..EngineConfig::new(Root::of::<App>())
    };
    let mut app = Headless::start(config).map_err(|e| format!("the engine did not start: {e}"))?;
    let shows = |app: &mut Headless, label: &str| {
        let query = format!("label:{label}");
        app.wait_until(label, Duration::from_secs(1), |screen| {
            screen.count(&query) == Ok(1)
        })
        .map(|_| ())
        .map_err(|e| e.to_string())
    };
    for label in ["Search", "Rust", "Not liked"] {
        shows(&mut app, label)?;
    }
    app.press("id:like").map_err(|e| e.to_string())?;
    shows(&mut app, "Liked")
}
