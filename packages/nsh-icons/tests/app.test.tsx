import { expect, open, test } from "nsh/test";
import { svgDataUri, svgMarkup } from "../src";
import { fixtureArrow } from "./fixtures/icons";

test("the screen shows an icon in each form, with their labels", async () => {
  const app = await open("../App.tsx", { clock: {} });
  await app.waitFor("text:nsh-icons");
  await app.waitFor("id:arrow");
  await app.waitFor("id:flag");
  await app.waitFor("label:Arrow");
  await app.waitFor("label:Star");
});

test("markup wraps the body in a whole SVG document", () => {
  expect(svgMarkup(fixtureArrow)).toBe(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" stroke="currentColor" d="M4 12h16"/></svg>',
  );
  expect(svgDataUri(fixtureArrow).startsWith("data:image/svg+xml,%3Csvg")).toBe(true);
});
