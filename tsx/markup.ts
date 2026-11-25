// An icon's SVG document, with no `nsh` import, so the CLI shares it.

/** What an icon's SVG is made of: the native `IconData` has it. */
export interface SvgParts {
  /** The SVG content inside `<svg>`. */
  body: string;
  /** `[left, top, width, height]`. */
  viewBox: readonly number[];
}

/** The whole SVG document of an icon. */
export function svgMarkup(icon: SvgParts): string {
  const [left, top, width, height] = icon.viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${width}" height="${height}">${icon.body}</svg>`;
}

/** The icon as a `data:` URL an `Image` shows. */
export function svgDataUri(icon: SvgParts): string {
  return `data:image/svg+xml,${encodeURIComponent(svgMarkup(icon))}`;
}
