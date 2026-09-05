import { ACTIVE_ATTR, HELD_ARRIVAL_ATTR, IMAGE_HOLD_ATTR, STATUS_ATTR } from "./domProtocol";
import { parseTranslateX } from "./sampling";

import type { LandingAudit } from "./types";

// THE LANDING PROBE: what the flight left behind once everything was supposed
// to be at rest.
//
// Run two rAF after the flight ends, which is where the engine's own COMPLETED
// cleanup and the deferred freeze land. Everything it looks for is a class of
// defect that has actually shipped: an inline pose left on a landed screen
// (the blank viewport), a hold marker with no owner left to release it (~130
// permanently blank avatars), a transitional status that never cleared (every
// later navigation swallowed).

/** How many rAF frames past flight end the landing audit waits. */
export const LANDING_AUDIT_FRAMES = 2;

/**
 * Hold markers still on the page at rest. Both of these are supposed to be
 * gone by the landing: whatever they hide has no owner left to reveal it.
 * Scanned document-wide on purpose — an orphan's screen is often exactly the
 * one that was swapped out from under the hold.
 *
 * `busy` is the caller's "another flight is already running" test. The audit
 * lands two frames after the previous flight ended, and by then a fast
 * back-to-back navigation legitimately owns hold markers of its own. A missed
 * detection is recoverable; blaming a flight for its successor's working holds
 * would train the reader to ignore the signal.
 */
export const orphanedHolds = (busy: boolean): string[] => {
  if (busy) return [];
  const found: string[] = [];
  for (const [attribute, label] of [
    [IMAGE_HOLD_ATTR, "image reveal hold"],
    [HELD_ARRIVAL_ATTR, "arrival hold"]
  ] as const) {
    // The selector is built from a constant attribute name, so it cannot be
    // invalid — no guard needed here.
    const count = document.querySelectorAll(`[${attribute}]`).length;
    if (count > 0) found.push(`${count} × ${label} (${attribute}) still marked at rest`);
  }
  return found;
};

export const auditLanding = (
  elements: readonly Element[],
  busy: boolean
): Omit<LandingAudit, "stuckStatuses"> => {
  const residual: string[] = [];
  let offViewport = false;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth ?? 0;
  elements.forEach((element, index) => {
    if (!(element instanceof HTMLElement) || !element.isConnected) return;
    let computedTransform = "";
    let computedDisplay = "";
    try {
      const computed = getComputedStyle(element);
      computedTransform = computed.transform ?? "";
      computedDisplay = computed.display ?? "";
    } catch {
      // Detached document: nothing to audit.
    }
    // Frozen screens (display:none — the engine's covered-screen freeze) own
    // their styles and paint nothing; skip them.
    if (computedDisplay === "none") return;
    const isActive = element.getAttribute(ACTIVE_ATTR) === "true";
    const label = `screen[${index}]${isActive ? " (active)" : ""}`;
    if (element.style.transform !== "" && element.style.transform !== "none") {
      residual.push(`${label} transform=${element.style.transform}`);
    }
    if (element.style.opacity !== "" && element.style.opacity !== "1") {
      residual.push(`${label} opacity=${element.style.opacity}`);
    }
    if (isActive && element.getAttribute(STATUS_ATTR) === "COMPLETED" && viewportWidth > 0) {
      const translateX = parseTranslateX(computedTransform);
      if (translateX !== null && Math.abs(translateX) >= viewportWidth * 0.5) {
        offViewport = true;
      }
    }
  });
  return {
    residualInlineTransforms: residual,
    offViewportAtRest: offViewport,
    orphanedHolds: orphanedHolds(busy)
  };
};
