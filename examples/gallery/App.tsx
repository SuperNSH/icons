import { mount, signal, Text, View } from "nsh";
import { Glyph, Icon, type IconData } from "nsh-icons";
import { phGearFill, phHeartFill, phHouseFill, phStarFill } from "./src/icon-font";
import * as icons from "./src/icons";

const all = Object.values(icons) as IconData[];
const sets = [...new Set(all.map((icon) => icon.set))];
const picked = signal(sets[0]);

/** Icons from several sets as SVG, a set switcher, and the same shapes as font glyphs. */
function App() {
  return (
    <View class="flex-1 gap-6 bg-background p-6">
      <View class="gap-1">
        <Text class="text-xl font-semibold text-foreground">nsh-icons</Text>
        <Text class="text-sm text-muted-foreground">Every Iconify set, drawn natively. SVG above, an icon font below.</Text>
      </View>
      <View class="flex-row flex-wrap gap-2">
        <Each of={sets}>
          {(set) => (
            <Text
              testID={`set-${set()}`}
              role="button"
              onPress={() => picked.set(set())}
              class={() =>
                picked() === set()
                  ? "rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1.5 text-sm text-foreground"
              }
            >
              {set()}
            </Text>
          )}
        </Each>
      </View>
      <View class="flex-row flex-wrap gap-3">
        <Each of={() => all.filter((icon) => icon.set === picked())}>
          {(icon) => (
            <View class="size-16 items-center justify-center rounded-lg border border-border bg-card">
              <Icon icon={icon()} size={28} color="#4f46e5" label={`${icon().set}:${icon().name}`} />
            </View>
          )}
        </Each>
      </View>
      <View class="flex-row gap-4">
        <Glyph glyph={phHouseFill} size={32} color="#4f46e5" label="Home glyph" />
        <Glyph glyph={phHeartFill} size={32} color="#4f46e5" label="Heart glyph" />
        <Glyph glyph={phStarFill} size={32} color="#4f46e5" label="Star glyph" />
        <Glyph glyph={phGearFill} size={32} color="#4f46e5" label="Gear glyph" />
      </View>
    </View>
  );
}

mount(App);
