"use client";

// Perception measurement anchor for the stress lab (playground-only, never a
// user affordance). A fixed corner square, transparent at rest, that
// `flashTapMarker()` flips white in the SAME synchronous tick as a stress-lab
// navigation. The video-energy analyzer (apps/web/e2e/perception/heavy-shell.mjs)
// uses that white blip as the freeze-gap anchor: it sits OUTSIDE the
// transitioning <Slot> (rendered by LabRouter, never inside a screen), so it
// stays spatially still while the transition moves, and the tblend-difference
// pass reads one isolated on-blip at the click tick instead of motion smeared by
// the animation.
//
// The trigger UI is the always-visible StressLabScreen; only this hidden anchor
// lives on the persistent router chrome, invisible to visitors until a run.

const MARKER_ID = "__labTapMarker";

// The marker is a ~1% corner flash: high enough for ffmpeg to see the tick, low
// enough that the analyzer's fixed motion-onset floor never mistakes it for the
// transition itself. Size is calibrated against that floor — don't shrink it
// without re-checking heavy-shell.mjs's ONSET constant.
const MARKER_SIZE = "size-16";

// Self-clear delay. The marker must stay white for the analyzer's whole capture
// window (heavy-shell.mjs closes the recording POST_MS = 2200ms after the tap),
// so the reset lands safely past it — the recording never sees the off-blip.
// Past that window the reset only serves real users: without it, a triggered
// marker would linger as a stray white corner square forever. 2600ms clears it
// for them while keeping the measurement identical to a never-resetting marker.
const MARKER_RESET_MS = 2600;

// Flip the marker white synchronously, then schedule it back to transparent.
// Called from the stress lab's primary action in the SAME tick as navigate.push,
// so the video's tap anchor and the transition's start share one clock. Reading
// the node by id (rather than a React ref) lets the trigger live on the screen
// while the marker lives on the persistent router chrome, without threading a ref
// across the <Slot>.
export function flashTapMarker() {
  if (typeof document === "undefined") return;
  const marker = document.getElementById(MARKER_ID);
  if (!marker) return;
  marker.style.background = "#ffffff";
  window.setTimeout(() => {
    marker.style.background = "transparent";
  }, MARKER_RESET_MS);
}

function LabTapMarker() {
  return (
    <div
      id={MARKER_ID}
      aria-hidden="true"
      className={`pointer-events-none fixed top-0 left-0 z-50 ${MARKER_SIZE} bg-transparent`}
    />
  );
}

export default LabTapMarker;
