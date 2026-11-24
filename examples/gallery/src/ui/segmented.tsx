// A segmented control: nsh/base's tab list with a pill that slides to the
// chosen segment, for the choices of the toolbar and the studio.
import { Text, type JSX } from "nsh";
import { Tab, Tabs } from "nsh/base";
import { TOUCH } from "./theme";

export function Segmented<T extends string>(props: {
  /** What screen readers call the group. */
  label: string;
  value: T;
  onChange: (id: T) => void;
  options: Array<{ id: T; label: string; accessibilityLabel?: string; icon?: JSX.Element }>;
  class?: string;
  /** Each segment's id follows it: `size-custom`. */
  testID?: string;
}) {
  return (
    <Tabs
      accessibilityLabel={props.label}
      class={`flex-row gap-1 rounded-(--radius) bg-muted p-1${props.class ? ` ${props.class}` : ""}`}
      indicatorClass="inset-y-1 rounded-md bg-background shadow-sm"
    >
      <Each of={props.options} key={(option) => option.id}>
        {(option) => (
          <Tab
            testID={props.testID ? `${props.testID}-${option().id}` : undefined}
            selected={props.value === option().id}
            onPress={() => props.onChange(option().id)}
            accessibilityLabel={option().accessibilityLabel}
            class={`flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-2 ${TOUCH ? "py-2" : "py-1"} text-muted-foreground selected:text-foreground focus-visible:ring-2 focus-visible:ring-ring`}
          >
            {option().icon}
            <Text class="text-xs font-medium">{option().label}</Text>
          </Tab>
        )}
      </Each>
    </Tabs>
  );
}
