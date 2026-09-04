export const STICKY_COLOR_CODES = ["R", "O", "Y", "G", "B", "P", "K", "C"] as const;

export type StickyColorCode = (typeof STICKY_COLOR_CODES)[number];

export const STICKY_COLOR_LABELS: Record<StickyColorCode, string> = {
  R: "Red",
  O: "Orange",
  Y: "Yellow",
  G: "Green",
  B: "Blue",
  P: "Purple",
  K: "Pink",
  C: "Cyan",
};

export const STICKY_COLOR_HEX: Record<StickyColorCode, string> = {
  R: "#FF3B30",
  O: "#FF9012",
  Y: "#FFD21E",
  G: "#3ECC4A",
  B: "#2F8BFF",
  P: "#9B4DFF",
  K: "#FF5FB0",
  C: "#1FD3D3",
};

export function isStickyColorCode(value: string): value is StickyColorCode {
  return (STICKY_COLOR_CODES as readonly string[]).includes(value);
}
