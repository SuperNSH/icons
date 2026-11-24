// Color picking: the shade area, hue and hex every tint opens, and the swatch
// that opens them for one color.
import { View } from "nsh";
import { Button, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, Popover } from "nsh/base";
import { popup } from "./theme";

/** A round swatch a finger or a pointer presses. */
export const swatch = "size-7 items-center justify-center rounded-full border border-border";
/** The same swatch while it is the color in use. */
export const swatchSelected = `${swatch} ring-2 ring-ring ring-offset-2 ring-offset-popover`;

export function Picker(props: { value: string; onChange: (hex: string) => void }) {
  return (
    <ColorPicker value={props.value} format="hex" onChange={(event) => props.onChange(event.formatted)} class="gap-3">
      <ColorArea accessibilityLabel="Shade" class="h-28" panelClass="rounded-md" fillThumb />
      <ColorSlider
        colorSpace="hsb"
        channel="hue"
        accessibilityLabel="Hue"
        class="h-6 justify-center"
        trackClass="h-4 rounded-full"
        thumbClass="size-4 rounded-full border-2 border-background"
        fillThumb
      />
      <View class="flex-row items-center gap-2">
        <ColorSwatch class="size-7 shrink-0 rounded-md border border-border" />
        <ColorField
          accessibilityLabel="Color as hex"
          class="h-7 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground"
        />
      </View>
    </ColorPicker>
  );
}

/** A swatch that opens the picker for the one color it shows. */
export function ColorStop(props: { testID: string; label: string; color: string; onPick: (hex: string) => void }) {
  return (
    <Popover
      trigger={
        <Button
          testID={props.testID}
          accessibilityLabel={props.label}
          class="size-8 items-center justify-center rounded-full hover:bg-muted active:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <View class="size-6 rounded-full border border-border" style={{ backgroundColor: props.color }} />
        </Button>
      }
      popupClass={`w-56 p-3 ${popup}`}
    >
      <Picker value={props.color} onChange={props.onPick} />
    </Popover>
  );
}
