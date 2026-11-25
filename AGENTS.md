# AGENTS.md

Hard rules for humans and coding agents in this repo.

- Never build, test, or run Docker, emulators or simulators on a developer's machine. GitHub Actions compiles and tests everything. Commit, push to `master`, and read the results with `gh run`. Running the CLI or `tools/fetch-data.ts` to regenerate committed files is fine.
- Commit small changes, each with a short conventional message and no attribution lines.
- Comments are 1-2 lines and state a non-obvious constraint. Never narrate the next line.
- Docs read like a competent human wrote them: direct, concrete, no marketing filler.
- Dead code is deleted. No speculative abstractions.
- Rust and TSX get the same component: one `#[component]` in `src/ui`, registered in `src/lib.rs`.
- Generated files are never edited by hand: everything in `sets`, `data`, `docs/sets.md`, `NOTICE.md` and the `CRATES` line of `scripts/publish-crates.sh` come from `tools/fetch-data.ts`; the gallery's committed files (`examples/gallery/src/demo-index.ts`, `src/icon-font.ts`, `assets/`) come from the CLI's `gallery` command, which also writes the gitignored `examples/gallery/src/data/` in CI.
- A name a set's `tsx/index.ts` exports never changes to mean another icon: the generator keeps the exports already committed.
- Each icon set keeps its own license. A new set crate needs a license that lets apps ship it.
- The main branch is `master`.

## Releasing

Add a `## [X.Y.Z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md` and push to `master`. The Changelog Release workflow bumps the versions, tags `vX.Y.Z`, creates the GitHub release with that entry as its notes and publishes to crates.io. Do not bump versions or push tags by hand. A crates.io version cannot be replaced, so CI must be green before the entry lands. crates.io takes one new crate every ten minutes after the first few, so a release that adds many can outlast the job. To finish a release that stopped halfway: `gh workflow run changelog-release.yml`, or `gh workflow run publish.yml -f tag=vX.Y.Z` for an older tag.
