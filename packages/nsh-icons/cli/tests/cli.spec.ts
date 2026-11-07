// The CLI's pieces under Bun's test runner: the resolver against the shared
// fixture (the Rust generator reads the same files), the generated modules,
// the font, and both data sources with no network.
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { type IconifySet, resolveAll, rustName, tsName } from "../../src/iconify.ts";
import { buildFont, fontProblem, glyphModule, iconModule, idsIn, parseId, pick, rustString } from "../generate.ts";
import { main } from "../nsh-icons.ts";
import { loadSet } from "../sources.ts";

const fixtures = join(import.meta.dir, "../../../../fixtures");

async function fixtureSet(): Promise<IconifySet> {
  return JSON.parse(await readFile(join(fixtures, "transforms.json"), "utf8"));
}

describe("the resolver", () => {
  test("matches the expectations the Rust generator is held to", async () => {
    const expected = JSON.parse(await readFile(join(fixtures, "transforms.expected.json"), "utf8"));
    expect(resolveAll(await fixtureSet())).toEqual(expected);
  });

  test("names icons for each language", () => {
    expect(tsName("fa7-solid", "arrow-left")).toBe("fa7SolidArrowLeft");
    expect(tsName("lucide", "1k")).toBe("lucide1k");
    expect(rustName("fa7-solid", "arrow-left")).toBe("FA7_SOLID_ARROW_LEFT");
    expect(rustName("4x", "a")).toBe("I_4X_A");
  });
});

describe("generated modules", () => {
  test("list their ids, so add keeps what is there", async () => {
    const set = await fixtureSet();
    const icons = [pick(set, "wide", "test"), pick(set, "arrow-back", "test")];
    const ts = iconModule(icons, "ts");
    expect(idsIn(ts)).toEqual(["fixture:arrow-back", "fixture:wide"]);
    expect(ts).toContain('export const fixtureArrowBack: IconData = {"set":"fixture","name":"arrow-back"');
    const rust = iconModule(icons, "rust");
    expect(rust).toContain("pub const FIXTURE_WIDE: Icon = Icon {");
    expect(rust).toContain("view_box: [0.0_f32, 0.0_f32, 20.0_f32, 10.0_f32]");
  });

  test("Rust strings escape quotes and anything outside ASCII", () => {
    expect(rustString('a"b\\c\né')).toBe('"a\\"b\\\\c\\n\\u{e9}"');
  });

  test("bad ids and unknown names are errors that say what to write", async () => {
    expect(() => parseId("heart")).toThrow("set:name");
    expect(() => pick({ prefix: "x", icons: {} }, "heart", "test")).toThrow("x has no icon `heart`");
  });
});

describe("fonts", () => {
  test("refuse strokes and multicolor icons, naming each", async () => {
    const set = await fixtureSet();
    const stroked = { ...pick(set, "arrow", "test"), body: '<path stroke="currentColor" d="M0 0"/>' };
    expect(fontProblem(stroked)).toContain("strokes");
    expect(fontProblem({ ...stroked, body: "<path/>", multicolor: true })).toContain("multicolor");
    expect(fontProblem({ ...stroked, body: '<path stroke="none" d="M0 0"/>' })).toBeUndefined();
    await expect(buildFont([stroked], "T")).rejects.toThrow("fixture:arrow is drawn with strokes");
  });

  test("build a TrueType font and a glyph map from U+E000", async () => {
    const set = await fixtureSet();
    const icons = [pick(set, "wide", "test"), pick(set, "1k", "test")];
    const ttf = await buildFont(icons, "Test");
    // TrueType's version tag, 0x00010000.
    expect([...ttf.slice(0, 4)]).toEqual([0, 1, 0, 0]);
    const map = glyphModule(icons, "Test", "../assets/icons.ttf", "ts");
    expect(map).toContain('import family from "../assets/icons.ttf";');
    expect(map).toContain("export const fixture1k: GlyphData = { family, codepoint: 0xe000 };");
    expect(map).toContain("export const fixtureWide: GlyphData = { family, codepoint: 0xe001 };");
    expect(glyphModule(icons, "Test", "icons.ttf", "rust")).toContain("codepoint: '\\u{e001}'");
  });
});

/** A one-file npm tarball, as the registry serves one. */
function tgz(path: string, body: string): Uint8Array {
  const data = new TextEncoder().encode(body);
  const header = new Uint8Array(512);
  const put = (at: number, text: string) => header.set(new TextEncoder().encode(text), at);
  put(0, path);
  put(100, "0000644\0");
  put(124, `${data.length.toString(8).padStart(11, "0")}\0`);
  put(156, "0");
  put(257, "ustar\0");
  put(148, "        ");
  const sum = header.reduce((n, b) => n + b, 0);
  put(148, `${sum.toString(8).padStart(6, "0")}\0 `);
  const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
  padded.set(data);
  const tar = new Uint8Array(512 + padded.length + 1024);
  tar.set(header);
  tar.set(padded, 512);
  return gzipSync(tar);
}

describe("sources", () => {
  test("a bundled set comes from the repo's data, pinned", async () => {
    const { set, source } = await loadSet("lucide");
    expect(set.prefix).toBe("lucide");
    expect(source).toStartWith("@iconify/json ");
  });

  test("any other set comes from its npm package, then the cache", async () => {
    process.env.XDG_CACHE_HOME = await mkdtemp(join(tmpdir(), "nsh-icons-"));
    const icons = JSON.stringify({ prefix: "made-up", icons: { dot: { body: "<circle r=\"1\"/>" } } });
    const asked: string[] = [];
    const fetcher = async (url: string) => {
      asked.push(url);
      if (url.endsWith("/latest")) return new TextEncoder().encode(JSON.stringify({ version: "1.0.0", dist: { tarball: "https://x/made-up.tgz" } }));
      return tgz("package/icons.json", icons);
    };
    const first = await loadSet("made-up", fetcher);
    expect(first.source).toBe("@iconify-json/made-up 1.0.0");
    expect(first.set.icons.dot.body).toBe('<circle r="1"/>');
    await loadSet("made-up", fetcher);
    // The second load reads the version, then the cache, not the tarball.
    expect(asked.filter((u) => u.endsWith(".tgz"))).toHaveLength(1);
  });
});

describe("the command line", () => {
  test("add writes a module and adds to it on the next call", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nsh-icons-"));
    const out = join(dir, "icons.ts");
    expect(await main(["add", "lucide:heart", "--out", out])).toBe(0);
    expect(await main(["add", "lucide:star", "--out", out])).toBe(0);
    expect(idsIn(await readFile(out, "utf8"))).toEqual(["lucide:heart", "lucide:star"]);
  });

  test("an unknown command is an error, and no command prints usage", async () => {
    await expect(main(["frobnicate"])).rejects.toThrow("no command `frobnicate`");
    expect(await main(["--help"])).toBe(0);
  });
});
