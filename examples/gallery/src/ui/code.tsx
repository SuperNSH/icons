// A snippet an app pastes: its name, the button that copies it, and the code.
import { Text, View } from "nsh";
import { Icon } from "supernsh-icons";
import { lucideCheck, lucideCopy } from "supernsh-icons-lucide";
import { Button } from "./button";

export function CodeBlock(props: { testID: string; label: string; code: string; copied: boolean; onCopy: () => void }) {
  return (
    <View class="gap-2">
      <View class="flex-row items-center justify-between gap-2">
        <Text class="text-xs font-semibold text-muted-foreground">{props.label}</Text>
        <Button
          testID={props.testID}
          size="sm"
          variant="ghost"
          onPress={props.onCopy}
          accessibilityLabel={`Copy the ${props.label} snippet`}
          class="-me-2 -my-1"
        >
          <Icon icon={props.copied ? lucideCheck : lucideCopy} size={14} />
          <Text>{props.copied ? "Copied" : "Copy"}</Text>
        </Button>
      </View>
      <View class="rounded-md bg-muted p-3">
        <Text class="select-text font-mono text-xs leading-5 text-foreground">{props.code}</Text>
      </View>
    </View>
  );
}
