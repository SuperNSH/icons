// Style values the whole gallery shares.
import { platform } from "nsh";

/** A finger drives the app: targets grow to the 44 points a touch needs. */
export const TOUCH = !platform.desktop;

/** The one surface of every floating layer: popovers, sheets and the studio. */
export const popup = "rounded-(--radius) border border-border bg-popover text-popover-foreground shadow-lg";
