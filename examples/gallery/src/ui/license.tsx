// A set's license, and the mark that it asks for more than most.
import { Text, View } from "nsh";
import { Icon } from "supernsh-icons";
import { lucideTriangleAlert } from "../chrome";
import type { DemoSet } from "../demo-index";

export function License(props: { meta: DemoSet }) {
  return (
    <View class={`flex-row flex-wrap items-center gap-1 ${props.meta.restrictive ? "text-warning" : "text-muted-foreground"}`}>
      <If when={props.meta.restrictive}>
        <Icon icon={lucideTriangleAlert} size={12} />
      </If>
      <Text class="text-xs">{props.meta.restrictive ? `${props.meta.license} · asks for attribution or limits use` : props.meta.license}</Text>
    </View>
  );
}
