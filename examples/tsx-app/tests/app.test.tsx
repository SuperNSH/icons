import { expect, open, test } from "nsh/test";
import { svgDataUri, svgMarkup } from "supernsh-icons/markup";
import { lucideHeart } from "supernsh-icons-lucide";

test("each form mounts, with its label and its size", async () => {
  const app = await open("../App.tsx", { clock: {} });
  await app.waitFor("label:Search");
  await app.waitFor("label:Rust");
  await app.waitFor("label:Japan");
  await app.waitFor("label:Star glyph");
  const search = app.layout("id:inherits");
  expect([search?.width, search?.height]).toEqual([48, 48]);
  // Twice as wide as tall, from its view box.
  const wide = app.layout("id:wide");
  expect([wide?.width, wide?.height]).toEqual([40, 20]);
});

test("an icon follows the signal it is drawn from", async () => {
  const app = await open("../App.tsx", { clock: {} });
  await app.waitFor("label:Not liked");
  await app.press("id:like");
  await app.waitFor("label:Liked");
});

test("markup wraps the body in a whole SVG document", () => {
  expect(svgMarkup(lucideHeart).startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><')).toBe(true);
  expect(svgDataUri(lucideHeart).startsWith("data:image/svg+xml,%3Csvg")).toBe(true);
});
