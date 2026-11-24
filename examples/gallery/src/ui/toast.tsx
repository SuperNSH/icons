// A short message over everything, for results no view can show: a file
// being saved, a clipboard that refused.
import { Overlay, safeArea, signal, Text, View } from "nsh";

const message = signal("");
let timer: number | undefined;

/** Shows `text` for two seconds. A new message replaces the one showing. */
export function toast(text: string) {
  message.set(text);
  clearTimeout(timer);
  timer = setTimeout(() => message.set(""), 2000);
}

export function Toaster() {
  return (
    <Overlay class="inset-x-0 bottom-0 items-center pointer-events-none" style={{ paddingBottom: safeArea().bottom + 24 }}>
      <If when={message()}>
        <View role="alert" class="max-w-sm rounded-full bg-foreground px-4 py-2 shadow-lg">
          <Text class="text-sm font-medium text-background">{message()}</Text>
        </View>
      </If>
    </Overlay>
  );
}
