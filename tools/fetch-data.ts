// Downloads the pinned @iconify/json release and writes what the repo commits from it: a crate per
// bundled set, the manifest of every set, docs/sets.md, NOTICE.md and the crate list of the publish script.
// Usage: bun tools/fetch-data.ts [version]
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { exportsIn } from "../cli/sources.ts";
import { untgz } from "../cli/tar.ts";
import { type IconifySet, resolveAll } from "../tsx/iconify.ts";
import { cargoToml, crateName, libRs, notice, noticeLine, nshJson, rustModule, tsModule, tsNames } from "./set-crate.ts";
import { BUNDLED } from "./sets.ts";

const root = join(import.meta.dir, "..");
const dataDir = join(root, "data");
const setsDir = join(root, "sets");
const pinFile = join(dataDir, "VERSION");

// Copyleft and non-commercial licenses: using one of these sets puts its terms on the app, so the docs flag them.
export const RESTRICTIVE = /^(GPL|LGPL|AGPL|CC-BY-SA|CC-BY-NC|CC-BY-NC-SA|MPL)/;

interface Collection {
  name: string;
  total?: number;
  author?: { name: string; url?: string };
  license?: { title: string; spdx?: string; url?: string };
  palette?: boolean;
  category?: string;
  hidden?: boolean;
}

interface ManifestEntry {
  prefix: string;
  name: string;
  total: number;
  license: string;
  licenseUrl: string;
  author: string;
  authorUrl: string;
  multicolor: boolean;
  category: string;
  restrictive: boolean;
  bundled: boolean;
  samples?: string[];
}

async function main() {
  const version = process.argv[2] ?? (await readFile(pinFile, "utf8").catch(() => "")).trim();
  if (!version) throw new Error("no version: pass one, or pin it in data/VERSION");

  const url = `https://registry.npmjs.org/@iconify/json/-/json-${version}.tgz`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const tar = untgz(new Uint8Array(await response.arrayBuffer()));
  const collections: Record<string, Collection> = JSON.parse(new TextDecoder().decode(tar.get("package/collections.json")!));

  await mkdir(setsDir, { recursive: true });
  for (const dir of await readdir(setsDir)) {
    if (!BUNDLED.includes(dir)) await rm(join(setsDir, dir), { recursive: true });
  }

  const crateVersion = /^version = "([^"]+)"/m.exec(await readFile(join(root, "Cargo.toml"), "utf8"))![1];
  const manifest: ManifestEntry[] = [];
  for (const prefix of Object.keys(collections).sort()) {
    const info = collections[prefix];
    const json = tar.get(`package/json/${prefix}.json`);
    if (!json || info.hidden) continue;
    const license = info.license?.spdx ?? info.license?.title ?? "unknown";
    const entry: ManifestEntry = {
      prefix,
      name: info.name,
      total: info.total ?? 0,
      license,
      licenseUrl: info.license?.url ?? "",
      author: info.author?.name ?? "",
      authorUrl: info.author?.url ?? "",
      multicolor: info.palette === true,
      category: info.category ?? "",
      restrictive: RESTRICTIVE.test(license),
      bundled: BUNDLED.includes(prefix),
    };
    if (entry.bundled) {
      const set: IconifySet = JSON.parse(new TextDecoder().decode(json));
      entry.samples = set.info?.samples;
      await writeCrate(entry, set, crateVersion);
    }
    manifest.push(entry);
  }

  const missing = BUNDLED.filter((p) => !manifest.some((s) => s.prefix === p));
  if (missing.length) throw new Error(`bundled sets not in @iconify/json ${version}: ${missing.join(", ")}`);
  await writeFile(pinFile, `${version}\n`);
  await writeFile(join(dataDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writePublishList();
  await writeDocs(manifest, version);
  console.log(`@iconify/json ${version}: ${manifest.length} sets, ${manifest.reduce((n, s) => n + s.total, 0)} icons`);
}

async function writeCrate(entry: ManifestEntry, set: IconifySet, version: string) {
  const dir = join(setsDir, entry.prefix);
  await mkdir(join(dir, "src"), { recursive: true });
  await mkdir(join(dir, "tsx"), { recursive: true });
  const icons = resolveAll(set);
  const before = new Map(exportsIn(await readFile(join(dir, "tsx/index.ts"), "utf8").catch(() => "")).map((e) => [e.icon.name, e.ident]));
  await writeFile(join(dir, "Cargo.toml"), cargoToml(entry));
  await writeFile(join(dir, "nsh.json"), nshJson(entry, version));
  await writeFile(join(dir, "NOTICE.md"), notice(entry));
  await writeFile(join(dir, "src/lib.rs"), libRs(entry));
  await writeFile(join(dir, "src/icons.rs"), rustModule(entry, icons));
  await writeFile(join(dir, "tsx/index.ts"), tsModule(entry, icons, tsNames(entry.prefix, icons, before)));
}

/** The crates in dependency order, which the publish and release scripts read. */
async function writePublishList() {
  const path = join(root, "scripts/publish-crates.sh");
  const text = await readFile(path, "utf8");
  const next = text.replace(/^CRATES=\(.*\)$/m, `CRATES=(supernsh-icons ${BUNDLED.map(crateName).join(" ")})`);
  if (!/^CRATES=\(/m.test(next)) throw new Error(`${path}: no CRATES line`);
  await writeFile(path, next);
}

async function writeDocs(manifest: ManifestEntry[], version: string) {
  const rows = manifest.map(
    (s) =>
      `| \`${s.prefix}\` | ${s.name} | ${s.total} | ${s.license}${s.restrictive ? " ⚠" : ""} | ${s.multicolor ? "multicolor" : "monotone"} | ${s.bundled ? `\`${crateName(s.prefix)}\`` : "CLI"} |`,
  );
  await writeFile(
    join(root, "docs/sets.md"),
    `# Icon sets

Every set from [@iconify/json](https://github.com/iconify/icon-sets) ${version}: ${manifest.length} sets, ${manifest.reduce((n, s) => n + s.total, 0)} icons. The prefix is the CLI's \`set:\` name. A set with a crate is installed with \`nsh add\`; the CLI writes the icons of any other. ⚠ marks a copyleft or non-commercial license: using that set puts its terms on your app. Generated by \`tools/fetch-data.ts\`.

| Prefix | Name | Icons | License | Colors | Crate |
|---|---|---|---|---|---|
${rows.join("\n")}
`,
  );
  await writeFile(
    join(root, "NOTICE.md"),
    `# Notices

The code in this repository is MIT licensed (\`LICENSE\`). The icon data is not ours, neither the sets under \`sets\` nor the ones the CLI downloads: each set keeps its own license, listed below from @iconify/json ${version}. An app that ships a set's icons must follow that set's license, including attribution where it asks for it.

${manifest.map(noticeLine).join("\n")}
`,
  );
}

if (import.meta.main) await main();
