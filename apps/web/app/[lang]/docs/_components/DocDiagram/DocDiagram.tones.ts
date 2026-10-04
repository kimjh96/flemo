import type { CSSProperties } from "react";

// The three ways a screen is drawn in the How it works diagrams: resting
// (muted), the screen arriving (accent), and the screen it leaves behind
// (warm). Colours come from the theme tokens, so every diagram follows light
// and dark mode with the rest of the page.
export type Tone = "muted" | "accent" | "warm";

const TONE_COLOR: Record<Tone, string> = {
  muted: "var(--fg-subtle)",
  accent: "var(--accent)",
  warm: "var(--warning)"
};

export const toneColor = (tone: Tone): string => TONE_COLOR[tone];

// A colour mixed into the surface, for fills that sit on the page background.
export const tint = (tone: Tone, percent: number): CSSProperties["fill"] =>
  tone === "muted"
    ? `color-mix(in srgb, var(--fg-subtle) ${Math.round(percent * 0.6)}%, var(--surface))`
    : `color-mix(in srgb, ${TONE_COLOR[tone]} ${percent}%, var(--surface))`;
