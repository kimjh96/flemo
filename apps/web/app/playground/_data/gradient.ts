// Album-art gradient generator. Takes a hue (0-360) and returns a CSS
// `linear-gradient(...)` string with two HSL stops. Hues are content (album
// artwork), not UI tokens, so they live as raw values here while every other
// surface in the playground stays on the shiflo palette.
export function gradientFor(hue: number): string {
  const top = `hsl(${hue}, 72%, 64%)`;
  const bottom = `hsl(${(hue + 28) % 360}, 60%, 38%)`;
  return `linear-gradient(160deg, ${top} 0%, ${bottom} 100%)`;
}
