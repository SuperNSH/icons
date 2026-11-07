# AGENTS.md

Hard rules for humans and coding agents in this repo.

- Never build, test, or run Docker, emulators or simulators on a developer's machine. GitHub Actions compiles and tests everything. Commit, push to `master`, and read the results with `gh run`. Running the CLI or `tools/fetch-data.ts` to regenerate committed files is fine.
- Commit small changes, each with a short conventional message and no attribution lines.
- Comments are 1-2 lines and state a non-obvious constraint. Never narrate the next line.
- Docs read like a competent human wrote them: direct, concrete, no marketing filler.
- Dead code is deleted. No speculative abstractions.
- The Rust generator (`crates/nsh-icons-codegen`) and the TypeScript resolver (`packages/nsh-icons/src/iconify.ts`) give the same output. A change lands in both, held by `fixtures/`.
- Generated files are never edited by hand: `crates/nsh-icons/data`, the crate's feature list, `docs/sets.md`, `NOTICE.md` come from `tools/fetch-data.ts`; `examples/gallery/src` and `assets` from the CLI.
- Each icon set keeps its own license. A new bundled set needs a license that lets apps ship it.
- The main branch is `master`.
