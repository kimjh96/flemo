"use client";

import { useState } from "react";

interface HeroDemoProps {
  lang: string;
}

function HeroDemo({ lang }: HeroDemoProps) {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = () => setLoaded(true);

  return (
    <div className="relative mx-auto h-[640px] w-[300px] sm:h-[700px] sm:w-[330px]">
      <div className="absolute inset-0 rounded-[44px] bg-[#191f28] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/40 dark:ring-white/10" />
      <div className="absolute inset-[5px] overflow-hidden rounded-[40px] bg-[var(--color-surface)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-[var(--color-surface)] transition-opacity duration-300"
          style={{ opacity: loaded ? 0 : 1, pointerEvents: loaded ? "none" : "auto" }}
        >
          <div className="flex items-center gap-1.5">
            <span className="hero-demo-dot" style={{ animationDelay: "0ms" }} />
            <span className="hero-demo-dot" style={{ animationDelay: "160ms" }} />
            <span className="hero-demo-dot" style={{ animationDelay: "320ms" }} />
          </div>
        </div>
        <iframe
          src={`/playground?lang=${lang}`}
          title="flemo live demo"
          className="absolute inset-0 h-full w-full border-0"
          loading="eager"
          tabIndex={-1}
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
}

export default HeroDemo;
