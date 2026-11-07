import { mount, Text, View } from "nsh";
import { Glyph, Icon } from "./src";
import { fixtureArrow, fixtureFlag } from "./tests/fixtures/icons";

/** The test screen: an icon in each form, read back by tests/app.test.tsx. */
function App() {
  return (
    <View class="flex-1 gap-3 p-4">
      <Text testID="title" class="text-foreground">nsh-icons</Text>
      <Icon testID="arrow" icon={fixtureArrow} size={32} color="#4f46e5" label="Arrow" />
      <Icon testID="flag" icon={fixtureFlag} size={16} color="#4f46e5" />
      <Glyph testID="glyph" glyph={{ family: "NshIcons", codepoint: 0xe000 }} label="Star" />
    </View>
  );
}

mount(App);
