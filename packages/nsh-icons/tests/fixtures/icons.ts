// Hand-written icon data in the shape `supernsh-icons add` writes.
import type { IconData } from "../../src";

export const fixtureArrow: IconData = {
  set: "fixture",
  name: "arrow",
  body: '<path fill="none" stroke="currentColor" d="M4 12h16"/>',
  viewBox: [0, 0, 24, 24],
  multicolor: false,
};

/** Twice as wide as tall, in its own colors. */
export const fixtureFlag: IconData = {
  set: "fixture",
  name: "flag",
  body: '<rect width="32" height="16" fill="#c00"/>',
  viewBox: [0, 0, 32, 16],
  multicolor: true,
};
