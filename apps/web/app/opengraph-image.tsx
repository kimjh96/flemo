import { ImageResponse } from "next/og";

import { LOGO_CARDS, LOGO_GAPS, LOGO_TINTS } from "@/components/Logo/logoPaths";

export const alt = "flemo: screens that move like apps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share card: the mark, the line, and the instrument grid, in the dark
// theme the site is designed in first.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#09090a",
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        color: "#ededef",
        fontFamily: "sans-serif"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width="64" height="64" viewBox="0 0 32 32">
          <path d={LOGO_CARDS[0]} fill={LOGO_TINTS.dark[0]} />
          <path d={LOGO_GAPS[0]} fill="#09090a" />
          <path d={LOGO_CARDS[1]} fill={LOGO_TINTS.dark[1]} />
          <path d={LOGO_GAPS[1]} fill="#09090a" />
          <path d={LOGO_CARDS[2]} fill="#5a8bff" />
        </svg>
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em" }}>flemo</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <span style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1 }}>
          Screens that move like apps.
        </span>
        <span style={{ fontSize: 32, color: "#a0a0a9" }}>
          A React router with native transitions, swipe back and shared elements.
        </span>
      </div>
    </div>,
    size
  );
}
