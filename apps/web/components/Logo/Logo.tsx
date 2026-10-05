"use client";

import { useId } from "react";

import { LOGO_CARDS, LOGO_GAPS } from "./logoPaths";

export interface LogoProps {
  size?: number;
  className?: string;
}

// The flemo mark: one screen caught at three moments of a push, smaller the
// further back in time, so the trail carries both motion and the depth of a
// stack. The trailing frames are solid tints of the accent from the theme
// tokens, and each is cut by the frame in front of it rather than overlapped.
//
// The cut is a mask, not a background-coloured gap, because the mark sits on
// the translucent header and must stay clean over whatever scrolls beneath.
function Logo({ size = 22, className }: LogoProps) {
  const id = useId().replace(/:/g, "");
  const fills = ["var(--logo-trail-1)", "var(--logo-trail-2)", "var(--accent)"];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        {LOGO_GAPS.map((gap, index) => (
          <mask key={gap} id={`${id}-cut-${index}`}>
            <rect width="32" height="32" fill="#fff" />
            <path d={gap} fill="#000" />
          </mask>
        ))}
      </defs>
      {LOGO_CARDS.map((card, index) => (
        <path
          key={card}
          d={card}
          fill={fills[index]}
          mask={index < LOGO_GAPS.length ? `url(#${id}-cut-${index})` : undefined}
        />
      ))}
    </svg>
  );
}

export default Logo;
