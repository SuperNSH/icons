// The sets the Rust crate bundles behind Cargo features: the most used UI,
// brand, flag and logo sets. Every other Iconify set is one CLI call away.
// crates.io takes at most 10 MB per crate, so the published data is split into
// supernsh-icons-data-1, -2 and -3; a set stays in the crate it was first published in.
export const DATA_CRATES: Record<string, string[]> = {
  "1": [
    "akar-icons", "ant-design", "fa7-brands", "fa7-solid", "fe", "flag", "iconoir",
    "ion", "logos", "lucide", "material-symbols", "streamline", "svg-spinners",
  ],
  "2": [
    "bi", "circle-flags", "devicon", "fluent", "hugeicons", "majesticons",
    "octicon", "ph", "radix-icons", "ri", "tabler",
  ],
  "3": [
    "bx", "carbon", "codicon", "fa7-regular", "heroicons", "line-md", "mdi",
    "mingcute", "mynaui", "simple-icons", "solar",
  ],
};

export const BUNDLED = Object.values(DATA_CRATES).flat();

/** The data crate that carries a bundled set. */
export function dataCrate(prefix: string): string {
  const found = Object.entries(DATA_CRATES).find(([, sets]) => sets.includes(prefix));
  if (!found) throw new Error(`${prefix} is in no data crate`);
  return found[0];
}
