// Mix a small slice of the album's hue into the screen surface so the tint
// tracks the shiflo light/dark token instead of being hard-coded for light.
export function tintBackgroundForHue(hue: number): string {
  return `linear-gradient(180deg, color-mix(in srgb, hsl(${hue}, 60%, 50%) 22%, var(--color-surface)) 0%, var(--color-surface) 60%)`;
}
