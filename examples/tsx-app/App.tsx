import { mount, signal, Text, View } from "nsh";
import { Glyph, Icon, type IconData } from "supernsh-icons";
import { circleFlagsJp } from "supernsh-icons-circle-flags";
import { logosRust } from "supernsh-icons-logos";
import { lucideHeart, lucideSearch, lucideStar } from "supernsh-icons-lucide";

/** Twice as wide as tall: its width follows its view box. */
const wide: IconData = {
  set: "made-up",
  name: "wide",
  body: '<rect width="32" height="16" fill="currentColor"/>',
  viewBox: [0, 0, 32, 16],
  multicolor: false,
};

/** An icon in each form, read back by tests/app.test.tsx. */
function App() {
  const liked = signal(false);
  return (
    <View class="flex-1 items-center justify-center gap-3 bg-background p-4 text-foreground">
      <Text class="text-foreground">supernsh-icons</Text>
      <View role="button" accessibilityLabel="Like" testID="like" onPress={() => liked.set(!liked())}>
        <Icon testID="reactive" icon={liked() ? lucideStar : lucideHeart} size={48} color={liked() ? "#16a34a" : "#e11d48"} label={liked() ? "Liked" : "Not liked"} />
      </View>
      <Icon testID="inherits" icon={lucideSearch} size={48} class="text-primary" label="Search" />
      <Icon testID="multicolor" icon={logosRust} size={48} label="Rust" />
      <Icon testID="masked" icon={circleFlagsJp} size={48} label="Japan" />
      <Icon testID="wide" icon={wide} size={20} />
      <Glyph testID="glyph" glyph={{ family: "NshIcons", codepoint: 0xe000 }} size={20} label="Star glyph" />
    </View>
  );
}

mount(App);
