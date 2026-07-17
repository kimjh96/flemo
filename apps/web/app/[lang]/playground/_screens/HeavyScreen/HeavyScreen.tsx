"use client";
"use no memo";

import { useRef } from "react";

import { Screen, useNavigate, useParams } from "@flemo/react";

// The stress lab's destination fixture — the disease shape shell-first fixes. The
// screen's CONSUMER CHILDREN (everything inside <Screen>) block the main thread
// on their FIRST render: a heavy tab that costs hundreds of ms to render/commit
// on device, reproduced here as a deterministic wall-clock busy-loop so it blocks
// identically on any machine (no CPU throttle needed). The block lands in the
// children render path on mount, exactly where a real heavy screen's cost lands,
// so a navigation that commits this screen while a transition is in flight is the
// exact case shell-first defers. Kept as the permanent reproduction the
// perception harness (apps/web/e2e/perception) drives.
//
// `"use no memo"` opts this out of React Compiler memoization so the busy-loop
// runs as written on every fresh mount, never elided.

interface HeavyContentProps {
  blockMs: number;
}

// One slice of the DIVISIBLE heavy shape: burns ~SLICE_MS in its own render.
// Real heavy screens are lists of components, so React's transition-lane
// renderer can YIELD between them; a wall of these reproduces that shape,
// where the atomic HeavyContent below reproduces the unsliceable worst case.
const SLICE_MS = 3;

function HeavySlice() {
  const spentRef = useRef(false);
  if (!spentRef.current) {
    spentRef.current = true;
    const end = performance.now() + SLICE_MS;
    while (performance.now() < end) {
      // busy-wait one slice
    }
  }
  return null;
}

interface SlicedHeavyContentProps {
  blockMs: number;
}

// The DIVISIBLE variant: ~blockMs of total render cost split into 3ms
// component slices (a 30-row list on device is exactly this shape). Under the
// shell-first startTransition lane React can yield between slices, so this
// measures what real content does to each driver, where HeavyContent measures
// the adversarial atomic bound.
function SlicedHeavyContent({ blockMs }: SlicedHeavyContentProps) {
  const slices = Math.max(1, Math.round(blockMs / SLICE_MS));
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--color-ink)] px-8 text-center text-white">
      {Array.from({ length: slices }, (_, index) => (
        <HeavySlice key={index} />
      ))}
      <span className="text-xs font-bold tracking-[0.3em] uppercase opacity-50">Heavy screen</span>
      <span className="mt-3 text-[clamp(3rem,12vw,8rem)] leading-none font-extrabold">
        {blockMs}ms
      </span>
      <p className="mt-4 max-w-xs text-sm leading-relaxed font-medium text-white/70">
        This list spent {blockMs}ms rendering across {slices} slices. The transition you just
        watched never waited for it.
      </p>
    </div>
  );
}

// The heavy child. Its FIRST render spins the main thread for `blockMs`, then
// paints a high-contrast panel (deliberately dark, distinct from the light
// stress lab it enters over, so the transition's cross-fade / slide produces a
// large, measurable per-frame motion energy — the measurement depends on this
// contrast, so the fixed always-dark `--color-ink` token is used on purpose, not
// as decorative chrome).
function HeavyContent({ blockMs }: HeavyContentProps) {
  const spentRef = useRef(false);
  if (!spentRef.current) {
    spentRef.current = true;
    const end = performance.now() + blockMs;
    // Deliberate synchronous block: the exact disease. Runs once, on mount.
    while (performance.now() < end) {
      // busy-wait — hold the main thread
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--color-ink)] px-8 text-center text-white">
      <span className="text-xs font-bold tracking-[0.3em] uppercase opacity-50">Heavy screen</span>
      <span className="mt-3 text-[clamp(3rem,12vw,8rem)] leading-none font-extrabold">
        {blockMs}ms
      </span>
      <p className="mt-4 max-w-xs text-sm leading-relaxed font-medium text-white/70">
        This content spent {blockMs}ms rendering on mount. The transition you just watched never
        waited for it.
      </p>
    </div>
  );
}

// The screen frame (the shell: background band + safe-area) is what flemo owns
// and renders in the FIRST commit; `HeavyContent` is the consumer child
// shell-first withholds until after the transition has started. The Back control
// is a consumer child too, so it lands with the content — swipe-back and the
// browser Back button both return during the block regardless.
function HeavyScreen() {
  const params = useParams<"/playground/heavy">();
  const navigate = useNavigate();
  const blockMs = Number(params?.block ?? "400") || 0;
  const sliced = params?.sliced === "1";

  const handleBack = () => {
    navigate.pop();
  };

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-ink)">
      <div className="relative h-full w-full">
        {sliced ? <SlicedHeavyContent blockMs={blockMs} /> : <HeavyContent blockMs={blockMs} />}
        <button
          type="button"
          onClick={handleBack}
          data-testid="heavy-back"
          className="absolute bottom-10 left-1/2 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to the lab
        </button>
      </div>
    </Screen>
  );
}

export default HeavyScreen;
