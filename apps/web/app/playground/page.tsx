"use client";

import { useEffect, useState } from "react";

import PlaygroundFrame from "./_components/PlaygroundFrame";
import PlaygroundTogglePanel from "./_components/PlaygroundTogglePanel";
import PlaygroundIntlProvider from "./_providers/PlaygroundIntlProvider";
import PlaygroundRouter from "./_router/PlaygroundRouter";

// `null` while detecting, then `true` if rendered inside an <iframe> (any
// origin), else `false`. The Hero on the landing page already provides the
// phone-frame chrome by iframing this route — drawing a second frame inside
// double-stacks the geometry and clips Screen content out of view. When
// embedded we render the bare PlaygroundRouter so the iframe IS the frame;
// when visited directly we add the frame and the toggle panel.
function detectEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default function PlaygroundPage() {
  // The Router reads `window.location.pathname` on first render to seed its
  // history. Without isolation that would be `/playground` — a path no Route
  // matches, and Renderer's destructuring would crash on `undefined.props`.
  // Rewrite history to `/` before mounting so the Router sees the playground
  // app's own root, then render.
  const [ready, setReady] = useState(false);
  const [embedded, setEmbedded] = useState<boolean | null>(null);
  const [lang, setLang] = useState("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Read the locale (the hero passes `/playground?lang=ko`) before rewriting
    // the URL to "/", which would drop the query.
    const queryLang = new URLSearchParams(window.location.search).get("lang");
    if (queryLang) setLang(queryLang);
    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
    setEmbedded(detectEmbedded());
    setReady(true);
  }, []);

  if (!ready || embedded === null) return null;

  if (embedded) {
    return (
      <PlaygroundIntlProvider lang={lang}>
        <PlaygroundRouter />
      </PlaygroundIntlProvider>
    );
  }

  return (
    <PlaygroundIntlProvider lang={lang}>
      <div className="min-h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-6 pb-24 pt-16 lg:gap-16 lg:pt-20">
          <header className="mx-auto flex max-w-[720px] flex-col items-center gap-4 text-center">
            <span className="kicker">Playground</span>
            <h1 className="display text-[40px] text-[var(--color-text-primary)] sm:text-[56px]">
              flemo, in motion.
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] sm:text-[16px]">
              A miniature music app powered by flemo&apos;s Router. Swap the screen transition, pin
              the shared bar — every choice reflects instantly in the phone preview, and the code
              that authored it sits right beside.
            </p>
          </header>

          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[auto_1fr] lg:gap-14">
            <div className="flex justify-center lg:sticky lg:top-24 lg:justify-end">
              <PlaygroundFrame>
                <PlaygroundRouter />
              </PlaygroundFrame>
            </div>
            <div className="flex justify-center lg:justify-start">
              <PlaygroundTogglePanel />
            </div>
          </div>
        </div>
      </div>
    </PlaygroundIntlProvider>
  );
}
