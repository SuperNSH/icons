// The gallery's sliders: one track and thumb everywhere, and the labeled
// field the studio lays out in a column.
import { Text, View } from "nsh";
import { Slider } from "nsh/base";
import { TOUCH } from "./theme";

/** The track fills the slider's row, and is taller than it looks: it is where a finger lands. */
export const sliderTrack = TOUCH ? "h-11 flex-1 justify-center" : "h-6 flex-1 justify-center";
export const sliderIndicator = "h-1.5 rounded-full bg-muted";
export const sliderRange = "rounded-full bg-primary";
export const sliderThumb = "size-4 rounded-full border border-border bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-ring";

export function SliderField(props: {
  label: string;
  /** What the value reads as: `85%`, `12`, `50%`. */
  display: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  testID?: string;
}) {
  return (
    <View class="gap-2">
      <View class="flex-row items-baseline justify-between gap-3">
        <Text class="text-xs font-medium text-muted-foreground">{props.label}</Text>
        <Text class="min-w-10 text-right font-mono text-xs tabular-nums text-foreground">{props.display}</Text>
      </View>
      <Slider
        testID={props.testID}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        accessibilityLabel={props.label}
        onChange={(event) => {
          if (typeof event.value === "number") props.onChange(event.value);
        }}
        class="w-full flex-row items-center gap-2"
        trackClass={sliderTrack}
        indicatorClass={sliderIndicator}
        rangeClass={sliderRange}
        thumbClass={sliderThumb}
      />
    </View>
  );
}
