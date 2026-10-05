import { ImageResponse } from "next/og";

import { LOGO_CARDS, LOGO_TILE_GAPS, LOGO_TINTS } from "@/components/Logo/logoPaths";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const TILE = "#0066cc";

// The home-screen icon: the tile mark at app-icon size, the same geometry as
// app/icon.svg. iOS rounds the corners itself, so the tile is a full square.
// Each cut is painted in the tile colour over the frame behind it, which is
// exact here because the tile is opaque.
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: TILE }}>
      <svg width="180" height="180" viewBox="0 0 32 32">
        <g transform="translate(5.3 5.3) scale(0.67)">
          <path d={LOGO_CARDS[0]} fill={LOGO_TINTS.tile[0]} />
          <path d={LOGO_TILE_GAPS[0]} fill={TILE} />
          <path d={LOGO_CARDS[1]} fill={LOGO_TINTS.tile[1]} />
          <path d={LOGO_TILE_GAPS[1]} fill={TILE} />
          <path d={LOGO_CARDS[2]} fill="#ffffff" />
        </g>
      </svg>
    </div>,
    size
  );
}
