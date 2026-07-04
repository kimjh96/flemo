// Whether a COMPUTED CSS color (getComputedStyle output: `rgb(...)` /
// `rgba(...)`, occasionally `color(srgb ...)`) is fully opaque. Conservative
// by design: anything unparseable reports NOT opaque, so a caller gating an
// optimization on opacity falls back to the safe path.
export default function isOpaqueColor(cssColor: string): boolean {
  const color = cssColor.trim().toLowerCase();
  if (color === "transparent" || color === "") return false;
  const rgb = color.match(/^rgb\(\s*\d+[\s,]+\d+[\s,]+\d+\s*\)$/);
  if (rgb) return true;
  const rgba = color.match(/^rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,/]+([\d.]+)\s*\)$/);
  if (rgba) return parseFloat(rgba[1]) >= 1;
  // Modern syntax: rgb(0 0 0 / 0.5) or color(srgb r g b / a)
  const slash = color.match(/\/\s*([\d.]+%?)\s*\)$/);
  if (slash) {
    const alpha = slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    return alpha >= 1;
  }
  if (color.startsWith("rgb(") || color.startsWith("color(")) return true;
  return false;
}
