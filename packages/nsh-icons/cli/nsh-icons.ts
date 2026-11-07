#!/usr/bin/env node
// nsh-icons: puts icons from any Iconify set into an NSH app, as SVG data
// (TS or Rust) or as an icon font. Runs on Node 24 (type stripping) or Bun.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveAll } from "../src/iconify.ts";
import { buildFont, glyphModule, iconModule, idsIn, type Lang, parseId, type Picked, pick } from "./generate.ts";
import { listSets, loadSet } from "./sources.ts";

const USAGE = `nsh-icons: icons from every Iconify set, for NSH apps

  nsh-icons add <set:name>... [--out src/icons.ts] [--lang ts|rust]
      Writes the icons as data, adding them to what --out already lists.
  nsh-icons font <set:name>... --out assets/icons.ttf [--map src/icon-font.ts]
                 [--family NshIcons] [--lang ts|rust]
      Builds an icon font of filled, one-color icons and its glyph map.
  nsh-icons search <text> --set <prefix>
      Lists the icons of a set whose names contain the text.
  nsh-icons sets
      Lists every set: prefix, icons, license, and whether the Rust crate bundles it.

Ids are Iconify's: lucide:heart, ph:star-fill, mdi:home. Browse them at https://icon-sets.iconify.design.`;

/** Loads each set once and resolves the ids in it. */
async function pickAll(ids: string[]): Promise<Picked[]> {
  const bySet = new Map<string, string[]>();
  for (const id of new Set(ids)) {
    const [set, name] = parseId(id);
    bySet.set(set, [...(bySet.get(set) ?? []), name]);
  }
  const picked: Picked[] = [];
  for (const [prefix, names] of bySet) {
    const { set, source } = await loadSet(prefix);
    for (const name of names) picked.push(pick(set, name, source));
  }
  return picked;
}

async function write(path: string, data: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/** `./x` style, as an import needs. */
function importPath(from: string, to: string): string {
  const path = relative(dirname(from), to).split("\\").join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      map: { type: "string" },
      lang: { type: "string", default: "ts" },
      family: { type: "string", default: "NshIcons" },
      set: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return command || values.help ? 0 : 1;
  }
  const lang = values.lang as Lang;
  if (lang !== "ts" && lang !== "rust") throw new Error(`--lang is ts or rust, not ${values.lang}`);
  const ext = lang === "ts" ? "ts" : "rs";

  switch (command) {
    case "add": {
      const out = resolve(values.out ?? `src/icons.${ext}`);
      const existing = existsSync(out) ? idsIn(await readFile(out, "utf8")) : [];
      if (!rest.length && !existing.length) throw new Error("name at least one icon: nsh-icons add lucide:heart");
      const icons = await pickAll([...existing, ...rest]);
      await write(out, iconModule(icons, lang));
      console.log(`${relative(process.cwd(), out)}: ${icons.length} icons`);
      return 0;
    }
    case "font": {
      if (!values.out) throw new Error("--out names the font file, such as assets/icons.ttf");
      const out = resolve(values.out);
      const map = resolve(values.map ?? `src/icon-font.${ext}`);
      const existing = existsSync(map) ? idsIn(await readFile(map, "utf8")) : [];
      const icons = await pickAll([...existing, ...rest]);
      if (!icons.length) throw new Error("name at least one icon: nsh-icons font ph:star-fill --out assets/icons.ttf");
      await write(out, await buildFont(icons, values.family!));
      await write(map, glyphModule(icons, values.family!, importPath(map, out), lang));
      console.log(`${relative(process.cwd(), out)} and ${relative(process.cwd(), map)}: ${icons.length} glyphs`);
      return 0;
    }
    case "search": {
      if (!values.set || !rest.length) throw new Error("nsh-icons search <text> --set <prefix>");
      const { set } = await loadSet(values.set);
      const text = rest.join("-").toLowerCase();
      const found = resolveAll(set).filter((i) => i.name.includes(text));
      for (const icon of found) console.log(`${values.set}:${icon.name}`);
      return found.length ? 0 : 1;
    }
    case "sets": {
      for (const s of await listSets()) {
        console.log(`${s.prefix.padEnd(28)} ${String(s.total).padStart(6)}  ${s.license.padEnd(16)} ${s.bundled ? "bundled" : ""}  ${s.name}`);
      }
      return 0;
    }
    default:
      throw new Error(`no command \`${command}\`\n\n${USAGE}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("nsh-icons.ts")) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: Error) => {
      console.error(`nsh-icons: ${error.message}`);
      process.exit(1);
    },
  );
}
