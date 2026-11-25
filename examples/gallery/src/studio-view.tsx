// The export studio: an in-app overlay where the composed preview stands
// beside the controls that change it, above the download they run. Ordinary
// views, not a `Dialog`: the web runtime paints a dialog's own layer late,
// which flashes the card's content over the app with no card behind it.
import { Image, Scroll, Text, View, computed, windowSize, type JSX } from "nsh";
import { Input } from "nsh/base";
import { Icon, type IconData } from "supernsh-icons";
import { lucideDownload, lucideX } from "supernsh-icons-lucide";
import {
  GRADIENT_LABELS,
  PADDING_MAX,
  RASTER_SIZES,
  SHAPE_MAX,
  bgFrom,
  bgMode,
  bgColor,
  bgTo,
  caption,
  cornerRadius,
  customSize,
  customSizeText,
  downloadLabel,
  fgFrom,
  fgTo,
  fillGradient,
  format,
  gradDir,
  jpegBg,
  jpegQuality,
  pad,
  pickSize,
  pngSize,
  previewSource,
  radiusPercent,
  runExport,
  shape,
  typeSize,
} from "./studio";
import { closeStudio, isWeb, previewFrame, studioIcon } from "./store";
import { Button, IconButton } from "./ui/button";
import { ColorStop } from "./ui/color";
import { License } from "./ui/license";
import { Segmented } from "./ui/segmented";
import { SliderField } from "./ui/slider";

/** From here the preview stands beside the controls instead of above them. */
const twoPane = computed(() => windowSize().width >= 760);

function Field(props: { label: string; children: JSX.Element }) {
  return (
    <View class="gap-2">
      <Text class="text-xs font-medium text-muted-foreground">{props.label}</Text>
      {props.children}
    </View>
  );
}

/** One gradient end: its swatch and which end it is. */
function Stop(props: { testID: string; label: string; end: string; color: string; onPick: (hex: string) => void }) {
  return (
    <View class="flex-row items-center gap-2">
      <ColorStop testID={props.testID} label={props.label} color={props.color} onPick={props.onPick} />
      <Text class="text-xs text-muted-foreground">{props.end}</Text>
    </View>
  );
}

function Settings(props: { icon: IconData }) {
  return (
    <View class="gap-5">
      <Field label="Format">
        <Segmented
          label="Export format"
          testID="studio-format"
          value={format()}
          onChange={(id) => format.set(id)}
          options={[
            { id: "svg", label: "SVG" },
            { id: "png", label: "PNG" },
            { id: "jpeg", label: "JPEG" },
          ]}
        />
        <If when={format() === "svg"}>
          <Text class="text-xs leading-5 text-muted-foreground">SVG keeps the glyph a vector: any size, transparent background.</Text>
        </If>
      </Field>
      <If when={format() !== "svg"}>
        {() => (
          <Field label="Pixel size">
            <Segmented
              label="Pixel size"
              testID="studio-size"
              value={customSize() ? "custom" : String(pngSize())}
              onChange={pickSize}
              options={[...RASTER_SIZES.map((pixels) => ({ id: String(pixels), label: String(pixels) })), { id: "custom", label: "Custom" }]}
            />
            <If when={customSize()}>
              <Input
                testID="studio-size-input"
                value={customSizeText()}
                placeholder={String(pngSize())}
                onChange={(event) => typeSize(event.value)}
                accessibilityLabel="Custom pixel size"
                class="rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm text-foreground"
              />
            </If>
          </Field>
        )}
      </If>
      <If when={format() === "jpeg"}>
        <SliderField
          testID="studio-quality"
          label="JPEG quality"
          display={`${jpegQuality()}%`}
          value={jpegQuality()}
          min={40}
          max={100}
          step={5}
          onChange={(value) => jpegQuality.set(value)}
        />
      </If>
      <If when={format() === "jpeg" && bgMode() === "none"}>
        <Field label="JPEG background">
          <View class="flex-row items-center gap-3">
            <ColorStop testID="studio-jpeg-base" label="JPEG background color" color={jpegBg()} onPick={(hex) => jpegBg.set(hex)} />
            <Text class="font-mono text-xs text-muted-foreground">{jpegBg()}</Text>
          </View>
          <Text class="text-xs leading-5 text-muted-foreground">JPEG has no transparency: this fills the canvas and its corners.</Text>
        </Field>
      </If>
      <SliderField testID="studio-pad" label="Padding" display={`${pad()}`} value={pad()} min={0} max={PADDING_MAX} step={4} onChange={(value) => pad.set(value)} />
      <Field label="Shape">
        <Segmented
          label="Icon shape"
          testID="studio-shape"
          value={shape()}
          onChange={(id) => shape.set(id)}
          options={[
            { id: "square", label: "Square" },
            { id: "rounded", label: "Rounded" },
            { id: "circle", label: "Circle" },
          ]}
        />
        <If when={shape() === "rounded"}>
          <SliderField
            testID="studio-radius"
            label="Corner radius"
            display={radiusPercent()}
            value={cornerRadius()}
            min={0}
            max={SHAPE_MAX}
            step={8}
            onChange={(value) => cornerRadius.set(value)}
          />
        </If>
      </Field>
      <Field label="Background">
        <Segmented
          label="Background"
          testID="studio-bg"
          value={bgMode()}
          onChange={(id) => bgMode.set(id)}
          options={[
            { id: "none", label: "None" },
            { id: "solid", label: "Solid" },
            { id: "gradient", label: "Gradient" },
          ]}
        />
        <If when={bgMode() === "solid"}>
          <View class="flex-row items-center gap-3">
            <ColorStop testID="studio-bg-color" label="Background color" color={bgColor()} onPick={(hex) => bgColor.set(hex)} />
            <Text class="font-mono text-xs text-muted-foreground">{bgColor()}</Text>
          </View>
        </If>
        <If when={bgMode() === "gradient"}>
          <View class="flex-row items-center gap-5">
            <Stop testID="studio-bg-from" label="Gradient start" end="Start" color={bgFrom()} onPick={(hex) => bgFrom.set(hex)} />
            <Stop testID="studio-bg-to" label="Gradient end" end="End" color={bgTo()} onPick={(hex) => bgTo.set(hex)} />
          </View>
        </If>
      </Field>
      <Field label="Icon fill">
        <If when={props.icon.multicolor}>
          <Text class="text-xs leading-5 text-muted-foreground">This icon keeps its own colors.</Text>
        </If>
        <If when={!props.icon.multicolor}>
          {() => (
            <View class="gap-2">
              <Segmented
                label="Icon fill"
                testID="studio-fill"
                value={fillGradient() ? "gradient" : "tint"}
                onChange={(id) => fillGradient.set(id === "gradient")}
                options={[
                  { id: "tint", label: "Tint" },
                  { id: "gradient", label: "Gradient" },
                ]}
              />
              <If when={fillGradient()}>
                <View class="flex-row items-center gap-5">
                  <Stop testID="studio-fg-from" label="Fill gradient start" end="Start" color={fgFrom()} onPick={(hex) => fgFrom.set(hex)} />
                  <Stop testID="studio-fg-to" label="Fill gradient end" end="End" color={fgTo()} onPick={(hex) => fgTo.set(hex)} />
                </View>
              </If>
            </View>
          )}
        </If>
      </Field>
      <If when={bgMode() === "gradient" || (fillGradient() && !props.icon.multicolor)}>
        <Field label="Direction">
          <Segmented
            label="Gradient direction"
            testID="grad-dir"
            value={gradDir()}
            onChange={(id) => gradDir.set(id)}
            options={(Object.keys(GRADIENT_LABELS) as Array<keyof typeof GRADIENT_LABELS>).map((dir) => ({ id: dir, label: GRADIENT_LABELS[dir] }))}
          />
        </Field>
      </If>
    </View>
  );
}

export function Studio() {
  return (
    <Each of={studioIcon()}>
      {(current) => {
        const icon = current().icon;
        return (
          <View class="absolute inset-0 z-50 flex-col items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+16px)]">
            <View
              testID="studio-backdrop"
              role="button"
              accessibilityLabel="Close the studio"
              onPress={closeStudio}
              class="absolute inset-0 bg-scrim/50"
            />
            {/* The card swallows presses, so taps on its quiet spots stay off the backdrop. In one
             * column its body is a scroll view, which gives the card no height of its own. */}
            <View
              testID="studio"
              onPress={() => {}}
              class={`relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl ${twoPane() ? "max-h-full" : "h-full"}`}
            >
              <View class="flex-row items-center gap-3 border-b border-border px-4 py-3">
                <View class="min-w-0 flex-1 gap-0.5">
                  <Text role="header" class="text-sm font-semibold text-foreground">
                    Export
                  </Text>
                  <Text class="truncate font-mono text-xs text-muted-foreground">{`${icon.set}:${icon.name}`}</Text>
                </View>
                <IconButton testID="studio-close" label="Close the studio" onPress={closeStudio}>
                  <Icon icon={lucideX} size={16} />
                </IconButton>
              </View>
              <If when={twoPane()}>
                {() => (
                  <View class="min-h-0 flex-1 flex-row">
                    <View class="w-64 shrink-0 items-center justify-center gap-3 border-e border-border p-4">
                      <Preview icon={icon} extent={176} open={bgMode() === "none"} />
                      <License meta={current().meta} />
                    </View>
                    <Scroll class="min-w-0 flex-1">
                      <View class="gap-5 p-4">
                        <Settings icon={icon} />
                      </View>
                    </Scroll>
                  </View>
                )}
              </If>
              <If when={!twoPane()}>
                {() => (
                  <Scroll class="min-h-0 flex-1">
                    <View class="gap-5 p-4">
                      <View class="items-center gap-3">
                        <Preview icon={icon} extent={128} open={bgMode() === "none"} />
                        <License meta={current().meta} />
                      </View>
                      <Settings icon={icon} />
                    </View>
                  </Scroll>
                )}
              </If>
              <View class="flex-row items-center gap-3 border-t border-border px-4 py-3">
                <Text class="min-w-0 flex-1 text-xs text-muted-foreground">{isWeb ? "The file is this preview, byte for byte." : "Saving files needs the web build."}</Text>
                <If when={isWeb}>
                  <Button testID="studio-download" variant="primary" onPress={() => runExport(icon)}>
                    <Icon icon={lucideDownload} size={16} />
                    <Text>{downloadLabel()}</Text>
                  </Button>
                </If>
              </View>
            </View>
          </View>
        );
      }}
    </Each>
  );
}

/** The file itself, with what it becomes. With no background of its own it
 * lies on the canvas its ink was chosen for, so the glyph stays in sight. */
function Preview(props: { icon: IconData; extent: number; open: boolean }) {
  return (
    <View class={`items-center justify-center rounded-xl border p-4 ${props.open ? previewFrame() : "border-border bg-card"}`}>
      <Image testID="studio-preview" src={previewSource(props.icon)} style={{ width: props.extent, height: props.extent }} accessibilityLabel="Export preview" />
      <Text class="mt-2 text-center text-xs leading-5 text-muted-foreground">{caption(props.icon)}</Text>
    </View>
  );
}
