// The explorer's screen: browsing a set, searching it, filtering variants,
// and the copy actions, with the clipboard the test host seeds and reads.
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
  // A desktop viewport, so the sidebar and detail panel stand open.
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("text:nsh-icons");
  await app.waitFor("id:card-lucide");
  await app.press("id:card-lucide");
  await app.waitFor("id:tile-lucide-heart");
  await app.waitFor("text:Lucide");
});

test("search narrows a set, and the detail panel copies what an app pastes", async () => {
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("id:card-lucide");
  await app.press("id:card-lucide");
  await app.waitFor("id:tile-lucide-heart");
  await app.type("id:search", "house");
  await app.waitFor("id:tile-lucide-house");
  await app.press("id:tile-lucide-house");
  await app.waitFor("id:detail");
  await app.waitFor("text:lucide:house");
  await app.press("id:copy-id");
  expect(await clipboardSettles(app, (text) => text === "lucide:house")).toBe("lucide:house");
  await app.press("id:copy-rust");
  expect(await clipboardSettles(app, (text) => text.includes("LUCIDE_HOUSE"))).toContain("LUCIDE_HOUSE");
});

test("a set with weights gets its variant chips, and global search counts sets", async () => {
  const app = await open("../App.tsx", { width: 1400, height: 900 });
  await app.waitFor("id:card-ph");
  await app.press("id:card-ph");
  await app.waitFor("id:tile-ph-heart");
  await app.waitFor("id:suffix-fill");
  await app.press("id:suffix-fill");
  await app.waitFor("id:tile-ph-heart-fill");
  await app.press("id:all-sets");
  await app.type("id:search", "heart");
  await app.waitFor("id:hit-lucide");
});
