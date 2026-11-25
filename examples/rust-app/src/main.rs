//! Runs the app directly on the machine's native backend.

#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
use nsh_platform_linux as platform;
#[cfg(target_os = "macos")]
use nsh_platform_macos as platform;
#[cfg(target_os = "windows")]
use nsh_platform_windows as platform;

fn main() -> impl std::process::Termination {
    platform::run_app(
        platform::AppSource::Rust(platform::Root::of::<rust_app::App>()),
        platform::AppOptions {
            title: "supernsh-icons".to_owned(),
            size: (480, 320),
            ..Default::default()
        },
    )
}
