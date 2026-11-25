// Where a set's Iconify JSON comes from: the repo's set crates when the CLI
// runs from a checkout, else the set's own npm package, cached.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type IconifySet, tsName } from "../tsx/iconify.ts";
import { untgz } from "./tar.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dataDir = join(root, "data");

export interface Loaded {
  set: IconifySet;
  /** Where it came from, written into generated files. */
  source: string;
}

/** One entry of the bundled `manifest.json`, as `tools/fetch-data.ts` writes it. */
export interface ManifestEntry {
  prefix: string;
  name: string;
  total: number;
  license: string;
  licenseUrl: string;
  author: string;
  multicolor: boolean;
  category: string;
  /** The license asks for attribution, or limits commercial use. */
  restrictive: boolean;
  bundled: boolean;
  /** A bundled set's own samples. */
  samples?: string[];
}

/** The pinned `@iconify/json` version and its manifest; nothing outside a checkout. */
export async function bundledManifest(): Promise<{ version: string; entries: ManifestEntry[] }> {
  const version = (await readFile(join(dataDir, "VERSION"), "utf8")).trim();
  const entries: ManifestEntry[] = JSON.parse(await readFile(join(dataDir, "manifest.json"), "utf8"));
  return { version, entries };
}

export interface Fetcher {
  (url: string): Promise<Uint8Array>;
}

const fetchBytes: Fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

function cacheDir(): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "supernsh-icons");
}

/** One line of a set crate's `tsx/index.ts`. */
interface Export {
  ident: string;
  icon: { name: string; body: string; viewBox: [number, number, number, number] };
}

/** The icons a set crate's `tsx/index.ts` exports, in its order. */
export function exportsIn(text: string): Export[] {
  return [...text.matchAll(/^export const (\w+): IconData = (\{.*\});$/gm)].map((match) => ({ ident: match[1], icon: JSON.parse(match[2]) }));
}

/** A bundled set's exports whose names are not `tsName`'s, by icon name. */
export async function renamedExports(prefix: string): Promise<Record<string, string>> {
  const exports = exportsIn(await readFile(join(root, "sets", prefix, "tsx/index.ts"), "utf8"));
  return Object.fromEntries(exports.filter((e) => e.ident !== tsName(prefix, e.icon.name)).map((e) => [e.icon.name, e.ident]));
}

/** A set read back from its crate's `tsx/index.ts`, its aliases already icons of their own. */
function bundledSet(entry: ManifestEntry, text: string): IconifySet {
  const icons: IconifySet["icons"] = {};
  for (const { icon } of exportsIn(text)) {
    const [left, top, width, height] = icon.viewBox;
    icons[icon.name] = { body: icon.body, left, top, width, height };
  }
  return {
    prefix: entry.prefix,
    info: { name: entry.name, author: { name: entry.author }, license: { spdx: entry.license }, palette: entry.multicolor, samples: entry.samples },
    icons,
  };
}

/** The set with this prefix, from its crate or npm. */
export async function loadSet(prefix: string, fetcher: Fetcher = fetchBytes): Promise<Loaded> {
  if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error(`\`${prefix}\` is not an Iconify prefix`);
  const module = join(root, "sets", prefix, "tsx/index.ts");
  if (existsSync(module)) {
    const { version, entries } = await bundledManifest();
    const entry = entries.find((e) => e.prefix === prefix);
    if (!entry) throw new Error(`data/manifest.json has no ${prefix}`);
    return { set: bundledSet(entry, await readFile(module, "utf8")), source: `@iconify/json ${version}` };
  }
  const meta = JSON.parse(new TextDecoder().decode(await fetcher(`https://registry.npmjs.org/@iconify-json/${prefix}/latest`)));
  const version: string = meta.version;
  const cached = join(cacheDir(), `${prefix}@${version}.json`);
  if (existsSync(cached)) return { set: JSON.parse(await readFile(cached, "utf8")), source: `@iconify-json/${prefix} ${version}` };
  const files = untgz(await fetcher(meta.dist.tarball));
  const json = files.get("package/icons.json");
  if (!json) throw new Error(`@iconify-json/${prefix} ${version} has no icons.json`);
  await mkdir(dirname(cached), { recursive: true });
  await writeFile(cached, json);
  return { set: JSON.parse(new TextDecoder().decode(json)), source: `@iconify-json/${prefix} ${version}` };
}

/** Every Iconify set: the bundled manifest, else Iconify's own list. */
export async function listSets(fetcher: Fetcher = fetchBytes): Promise<ManifestEntry[]> {
  const manifest = join(dataDir, "manifest.json");
  if (existsSync(manifest)) return JSON.parse(await readFile(manifest, "utf8"));
  const collections = JSON.parse(new TextDecoder().decode(await fetcher("https://raw.githubusercontent.com/iconify/icon-sets/master/collections.json")));
  return Object.entries(collections as Record<string, { name: string; total?: number; license?: { spdx?: string; title?: string }; hidden?: boolean }>)
    .filter(([, c]) => !c.hidden)
    .map(([prefix, c]) => ({
      prefix,
      name: c.name,
      total: c.total ?? 0,
      license: c.license?.spdx ?? c.license?.title ?? "unknown",
      licenseUrl: "",
      author: "",
      multicolor: false,
      category: "",
      restrictive: false,
      bundled: false,
    }));
}
