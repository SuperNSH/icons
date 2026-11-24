// The gallery's buttons on nsh/base's press target: a primary action where a
// region has one, outlined defaults, and the quiet ghost and icon buttons.
import { type JSX } from "nsh";
import { Button as Pressable } from "nsh/base";
import { TOUCH } from "./theme";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md";

const FILL: Record<Variant, string> = {
  // An inset ring: the accent ring would vanish into the primary fill.
  primary: "bg-primary text-primary-foreground active:bg-primary/90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground",
  outline: "border border-border bg-card text-foreground hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
  ghost: "text-foreground hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
};
const FRAME: Record<Size, string> = { sm: "min-h-8 px-3 py-1 text-xs", md: "min-h-10 px-4 py-2 text-sm" };
const ICON_FRAME: Record<Size, string> = { sm: "size-7", md: "size-8" };
/** What grows each button to 44 points on a touch screen. */
const REACH: Record<Size, { button: number; icon: number }> = { sm: { button: 6, icon: 8 }, md: { button: 2, icon: 6 } };
/** The smallest size a touch screen gets: its targets still reach 44 points. */
export const control = TOUCH ? "md" : "sm";

export function Button(props: {
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  class?: string;
  testID?: string;
  accessibilityLabel?: string | null;
  disabled?: boolean;
  selected?: boolean;
  children?: JSX.Element;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      selected={props.selected}
      testID={props.testID}
      accessibilityLabel={props.accessibilityLabel}
      hitSlop={TOUCH ? REACH[props.size ?? "md"].button : undefined}
      class={`flex-row items-center justify-center gap-2 rounded-(--radius) font-medium ${FRAME[props.size ?? "md"]} ${FILL[props.variant ?? "outline"]}${props.class ? ` ${props.class}` : ""}`}
    >
      {props.children}
    </Pressable>
  );
}

/** A button whose label is an icon: `label` is what screen readers say. */
export function IconButton(props: { onPress?: () => void; label: string; size?: Size; class?: string; testID?: string; children?: JSX.Element }) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityLabel={props.label}
      testID={props.testID}
      hitSlop={TOUCH ? REACH[props.size ?? "md"].icon : undefined}
      class={`items-center justify-center rounded-(--radius) text-foreground hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${ICON_FRAME[props.size ?? "md"]}${props.class ? ` ${props.class}` : ""}`}
    >
      {props.children}
    </Pressable>
  );
}
