import { Image, Text } from "nsh";
import type { ColorValue } from "nsh";
import { type IconData, svgDataUri } from "./markup";

/** One glyph of a font `nsh-icons font` made. */
export interface GlyphData {
  /** The font's family name: the default export of its `.ttf` import. */
  family: string;
  /** The private-use code point the CLI gave the icon. */
  codepoint: number;
}

export interface IconProps {
  icon: IconData;
  /** Its height in points (24); the width keeps the icon's aspect ratio. */
  size?: number;
  /** The tint of a monotone icon. Multicolor icons keep their colors. */
  color?: ColorValue;
  /** What a screen reader says. Leave it out when text beside it says the same. */
  label?: string;
  testID?: string;
}

/** An icon drawn sharp at any size. */
export function Icon(props: IconProps) {
  const size = () => props.size ?? 24;
  const [, , width, height] = props.icon.viewBox;
  return (
    <Image
      src={svgDataUri(props.icon)}
      testID={props.testID}
      accessibilityLabel={props.label}
      style={{
        width: (size() * width) / height,
        height: size(),
        tintColor: props.icon.multicolor ? undefined : props.color,
      }}
    />
  );
}

export interface GlyphProps {
  glyph: GlyphData;
  /** Its font size in points (24). */
  size?: number;
  color?: ColorValue;
  label?: string;
  testID?: string;
}

/** An icon-font glyph, laid out as text. */
export function Glyph(props: GlyphProps) {
  return (
    <Text
      testID={props.testID}
      accessibilityLabel={props.label}
      style={{ fontFamily: props.glyph.family, fontSize: props.size ?? 24, color: props.color }}
    >
      {String.fromCodePoint(props.glyph.codepoint)}
    </Text>
  );
}
