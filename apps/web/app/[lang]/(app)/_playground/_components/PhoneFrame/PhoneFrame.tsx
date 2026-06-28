"use client";

import type { PropsWithChildren } from "react";

// A clean device frame for the demo. Dark bezel, rounded screen cutout; the
// children (the wallet's nested Router) fill the interior. Unlike a promo
// screenshot, this is our own UI, so a real bezel reads correctly.
function PhoneFrame({ children }: PropsWithChildren) {
  return (
    <div className="aspect-[300/620] w-full rounded-[44px] border border-white/10 bg-[var(--color-ink)] p-[10px] shadow-[0_30px_70px_-24px_rgba(15,19,27,0.5)]">
      <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-[var(--color-bg)]">
        {children}
      </div>
    </div>
  );
}

export default PhoneFrame;
