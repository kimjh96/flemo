"use client";
"use no memo";

import { useRef } from "react";

import { Screen, useParams } from "@flemo/react";

// Standing perception fixture — the disease shape shell-first fixes. The
// screen's CONSUMER CHILDREN (everything inside <Screen>) block the main thread
// on their FIRST render: a heavy tab that costs ~380ms to render/commit on
// device, reproduced here as a deterministic wall-clock busy-loop so it blocks
// identically on any machine (no CPU throttle needed). The block lands in the
// children render path on mount, exactly where a real heavy screen's cost lands,
// so a navigation that commits this screen while a transition is in flight is
// the exact case shell-first defers. Kept as the permanent reproduction the
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
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#0b1220] text-white">
      {Array.from({ length: slices }, (_, index) => (
        <HeavySlice key={index} />
      ))}
      <span className="text-xs font-bold tracking-[0.3em] uppercase opacity-60">Heavy screen</span>
      <span className="mt-2 text-[clamp(3rem,12vw,8rem)] leading-none font-extrabold">
        {blockMs}ms
      </span>
      <span className="mt-2 text-sm font-semibold opacity-70">sliced children render</span>
    </div>
  );
}

// The heavy child. Its FIRST render spins the main thread for `blockMs`, then
// paints a high-contrast panel (distinct from the light gradient panels it
// enters over, so the transition's cross-fade / slide produces a large,
// measurable per-frame motion energy).
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
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#0b1220] text-white">
      <span className="text-xs font-bold tracking-[0.3em] uppercase opacity-60">Heavy screen</span>
      <span className="mt-2 text-[clamp(3rem,12vw,8rem)] leading-none font-extrabold">
        {blockMs}ms
      </span>
      <span className="mt-2 text-sm font-semibold opacity-70">synchronous children commit</span>
    </div>
  );
}

// The screen frame (the shell: background band + safe-area) is what flemo owns
// and renders in the FIRST commit; `HeavyContent` is the consumer child
// shell-first withholds until after the transition has started.
function HeavyScreen() {
  const params = useParams<"/playground/heavy">();
  const blockMs = Number(params?.block ?? "400") || 0;
  const sliced = params?.sliced === "1";

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="#0b1220">
      {sliced ? <SlicedHeavyContent blockMs={blockMs} /> : <HeavyContent blockMs={blockMs} />}
    </Screen>
  );
}

export default HeavyScreen;
