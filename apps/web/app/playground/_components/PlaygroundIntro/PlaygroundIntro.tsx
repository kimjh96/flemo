"use client";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";

// The kicker and the "flemo, in motion." wordmark stay English in every locale.
// They read as a brand tagline, not body copy. Only the description below is
// localized.
function PlaygroundIntro() {
  const dict = usePlaygroundDict();

  return (
    <header className="mx-auto flex max-w-[720px] flex-col items-center gap-4 text-center">
      <span className="kicker">Playground</span>
      <h1 className="display text-[40px] text-[var(--color-text-primary)] sm:text-[56px]">
        flemo, in motion.
      </h1>
      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] sm:text-[16px]">
        {dict.intro.description}
      </p>
    </header>
  );
}

export default PlaygroundIntro;
