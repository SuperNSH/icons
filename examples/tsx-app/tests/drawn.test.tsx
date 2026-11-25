// Only with --target: headless draws nothing. CI keeps the picture.
import { open, test } from "nsh/test";

test("the icons are drawn", async () => {
  const app = await open("../App.tsx", { width: 400, height: 480 });
  await app.waitFor("label:Japan");
  await app.screenshot("drawn.png").catch((error: Error) => {
    if (!error.message.includes("--target")) throw error;
  });
});
