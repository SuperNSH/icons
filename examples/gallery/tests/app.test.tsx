// The explorer's screen: browsing a set, searching it, filtering variants,
// and the copy and export actions, with the clipboard the test host seeds
// and reads. The grids virtualize, so each test searches, or scrolls, before
// it expects a row: one far down the alphabet never enters the window on its
// own.
import { expect, open, test } from "nsh/test";

type App = Awaited<ReturnType<typeof open>>;

/** Polls the clipboard until `want` holds, and returns what it settled on. */
async function clipboardSettles(app: App, want: (text: string) => boolean): Promise<string> {
  let text = "";
  for (let tries = 0; tries < 50 && !want(text); tries++) {
    await new Promise((done) => setTimeout(done, 100));
    text = (await app.clipboard()) ?? "";
  }
  return text;
}

test("the home lists every set, and a set's grid shows its icons", async () => {
  // A desktop viewport, so the sidebar and detail pane stand open.
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("text:supernsh-icons");
  await app.waitFor("id:card-lucide");
  await app.press("id:card-lucide");
  await app.type("id:search", "heart");
  await app.waitFor("id:tile-lucide-heart");
});

test("a chosen tile is marked, and the detail pane copies what an app pastes", async () => {
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("id:card-lucide");
  await app.press("id:card-lucide");
  await app.type("id:search", "house");
  await app.waitFor("id:tile-lucide-house");
  expect(app.viewStyle("id:tile-lucide-house")?.backgroundColor).toBeFalsy();
  await app.press("id:tile-lucide-house");
  await app.waitFor("text:lucide:house");
  expect(app.viewStyle("id:tile-lucide-house")?.backgroundColor).toBeTruthy();
  await app.press("id:copy-id");
  expect(await clipboardSettles(app, (text) => text === "lucide:house")).toBe("lucide:house");
  await app.press("id:copy-ts");
  const ts = await clipboardSettles(app, (text) => text.includes("lucideHouse"));
  expect(ts).toContain('import { Icon } from "supernsh-icons"');
  expect(ts).toContain("<Icon icon={lucideHouse}");
  await app.press("id:copy-rust");
  expect(await clipboardSettles(app, (text) => text.includes("LUCIDE_HOUSE"))).toContain("LUCIDE_HOUSE");
  await app.press("id:copy-svg");
  expect(await clipboardSettles(app, (text) => text.startsWith("<svg"))).toContain('viewBox="0 0 24 24"');
  await app.press("id:copy-add");
  expect(await clipboardSettles(app, (text) => text.startsWith("supernsh-icons add lucide:house"))).toContain("--out src/icons.ts");
});

test("a set with weights gets its variant chips, and global search lists the sets with matches", async () => {
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("id:card-ph");
  await app.press("id:card-ph");
  await app.waitFor("id:suffix-fill");
  await app.type("id:search", "heart");
  await app.press("id:suffix-fill");
  await app.waitFor("id:tile-ph-heart-fill");
  await app.press("id:all-sets");
  await app.waitFor("id:hit-fluent");
  // Lucide is the fifteenth set by matches: it renders once scrolled near.
  await app.scroll("id:hits", 1200);
  await app.waitFor("id:hit-lucide");
  expect(app.shows("text:17 matches")).toBe(true);
});

test("a name a global search shows jumps to its icon, in its set", async () => {
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("id:card-lucide");
  await app.type("id:search", "house");
  await app.waitFor("id:hit-ph-house");
  await app.press("id:hit-ph-house");
  await app.waitFor("text:ph:house");
  await app.waitFor("id:tile-ph-house");
});

test("a narrow window carries the sets and the detail in sheets", async () => {
  const app = await open("../App.tsx", { width: 720, height: 900 });
  // The sidebar's title lives in the closed sheet; the Sets button is what shows.
  await app.waitFor("id:sets-button");
  await app.press("id:sets-button");
  await app.waitFor("id:all-sets");
  await app.press("id:all-sets");
  await app.waitFor("id:card-lucide");
  await app.press("id:card-lucide");
  await app.type("id:search", "house");
  await app.waitFor("id:tile-lucide-house");
  await app.press("id:tile-lucide-house");
  await app.waitFor("id:detail-close");
  await app.waitFor("text:lucide:house");
  await app.press("id:action-export");
  await app.waitFor("id:studio-preview");
});

test("the studio composes the export: shape, padding and fill retile the preview", async () => {
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("id:card-lucide");
  await app.press("id:card-lucide");
  await app.type("id:search", "heart");
  await app.waitFor("id:tile-lucide-heart");
  await app.press("id:tile-lucide-heart");
  await app.press("id:action-export");
  await app.waitFor("id:studio-preview");
  await app.waitFor("id:studio-pad");
  await app.press("id:studio-shape-circle");
  await app.waitFor("id:studio-bg-gradient");
  await app.press("id:studio-bg-gradient");
  await app.waitFor("id:studio-bg-from");
  await app.press("id:studio-fill-gradient");
  await app.waitFor("id:studio-fg-from");
  await app.waitFor("id:studio-preview");
});

test("the studio picks a raster format, sizes it, and hands the file to the downloader", async () => {
  // The web platform, so the download button stands in the studio.
  const app = await open("../App.tsx", { width: 1400, height: 900, platform: "web" });
  await app.waitFor("id:card-lucide");
  await app.press("id:card-lucide");
  await app.type("id:search", "house");
  await app.waitFor("id:tile-lucide-house");
  await app.press("id:tile-lucide-house");
  await app.press("id:action-export");
  await app.waitFor("id:studio-preview");
  await app.press("id:studio-format-jpeg");
  await app.waitFor("id:studio-quality");
  await app.waitFor("id:studio-jpeg-base");
  await app.press("id:studio-size-custom");
  await app.waitFor("id:studio-size-input");
  await app.type("id:studio-size-input", "1000");
  await app.press("id:studio-download");
  await app.waitFor("text:Saving lucide-house-1000.jpg");
  await app.press("id:studio-format-svg");
  await app.press("id:studio-download");
  await app.waitFor("text:Saving lucide-house.svg");
});
