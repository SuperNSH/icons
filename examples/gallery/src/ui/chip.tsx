// A filter chip: one of a wrapping row of choices, where any one can be on.
import { Text } from "nsh";
import { Button } from "nsh/base";
import { TOUCH } from "./theme";

export function Chip(props: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <Button
      selected={props.selected}
      onPress={props.onPress}
      testID={props.testID}
      hitSlop={TOUCH ? 10 : undefined}
      class={`flex-row items-center rounded-full border px-2.5 py-1 ${props.selected ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted active:bg-muted"} focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <Text class="text-xs font-medium">{props.label}</Text>
    </Button>
  );
}
