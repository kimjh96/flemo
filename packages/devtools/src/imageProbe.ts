import { IMAGE_HOLD_ATTR } from "./domProtocol";

import type { ImageActivity } from "./types";

// THE IMAGE PROBE.
//
// Glass-measured 2026-08-18: an <img> that finishes loading DURING a flight
// decodes and first-rasters on the moving layer, and costs exactly one skipped
// present. The engine answers it by holding still-loading images for the
// flight span, so what this probe watches for is a completion WITHOUT a hold —
// that regression coming back.

/**
 * Ceiling on tracked images per flight. A list commit can append hundreds at
 * once, and the recorder must never become the cost it is measuring — past
 * this point the sample is already conclusive either way.
 */
const MAX_TRACKED_IMAGES = 200;

export interface ImageProbeState {
  /** Images being tracked for this flight: loading at t0, plus arrivals. */
  tracked: Set<HTMLImageElement>;
  loadingAtStart: number;
  addedDuringFlight: number;
  held: Set<Element>;
}

/** Every <img> inside the flight's participating screens. */
const participantImages = (screens: readonly Element[]): HTMLImageElement[] => {
  const images: HTMLImageElement[] = [];
  for (const screen of screens) {
    for (const img of Array.from(screen.querySelectorAll("img"))) images.push(img);
  }
  return images;
};

export const createImageProbeState = (screens: readonly Element[]): ImageProbeState => {
  const tracked = new Set(participantImages(screens).filter((img) => !img.complete));
  return { tracked, loadingAtStart: tracked.size, addedDuringFlight: 0, held: new Set() };
};

/**
 * Images that arrive DURING the flight — a data commit landing mid-navigation,
 * which is the case core's image hold watches for with its own observer.
 * Without this the probe would only ever see the screens as they looked at t0.
 */
export const trackAddedImages = (
  state: ImageProbeState,
  elements: readonly Element[],
  added: NodeList
): void => {
  if (state.tracked.size >= MAX_TRACKED_IMAGES) return;
  for (const node of Array.from(added)) {
    if (!(node instanceof Element)) continue;
    // Only inside this flight's participants: a mutation elsewhere on the
    // page is not on the moving layer.
    if (!elements.some((screen) => screen === node || screen.contains(node))) continue;
    const images =
      node instanceof HTMLImageElement ? [node] : Array.from(node.querySelectorAll("img"));
    for (const img of images) {
      if (img.complete || state.tracked.has(img)) continue;
      if (state.tracked.size >= MAX_TRACKED_IMAGES) return;
      state.tracked.add(img);
      state.addedDuringFlight += 1;
    }
  }
};

/** One query per flight, on the first moving frame: which images the engine parked. */
export const snapshotHeldImages = (state: ImageProbeState, elements: readonly Element[]): void => {
  for (const screen of elements) {
    for (const held of Array.from(screen.querySelectorAll(`img[${IMAGE_HOLD_ATTR}]`))) {
      state.held.add(held);
    }
  }
  // A mid-flight arrival can be parked after that sweep, so re-check the
  // tracked set directly rather than relying on one query.
  for (const img of state.tracked) {
    if (img.hasAttribute(IMAGE_HOLD_ATTR)) state.held.add(img);
  }
};

/**
 * Per-image accounting. Counting completions and holds separately and
 * subtracting would cancel a held-but-still-loading image against an unheld
 * completed one, hiding the exact regression this exists to catch.
 */
export const imageActivity = (state: ImageProbeState): ImageActivity => {
  let completed = 0;
  let completedUnheld = 0;
  for (const img of state.tracked) {
    if (!img.complete) continue;
    completed += 1;
    if (!state.held.has(img)) completedUnheld += 1;
  }
  return {
    loadingAtStart: state.loadingAtStart,
    addedDuringFlight: state.addedDuringFlight,
    completedDuringFlight: completed,
    heldDuringFlight: state.held.size,
    completedUnheld
  };
};
