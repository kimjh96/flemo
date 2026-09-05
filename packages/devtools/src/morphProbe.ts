import {
  MORPH_ATTR,
  MORPH_CAMERA_ATTR,
  MORPH_GHOST_ATTR,
  MORPH_ID_ATTR,
  MORPH_LAYER_ATTR,
  MORPH_ROLES,
  MORPH_SHEET_ATTR,
  MORPH_STAND_IN_ATTR,
  SCREEN_ATTR,
  attrSelector
} from "./domProtocol";

import type { MorphActivity, TripwireHit } from "./types";

// THE MORPH PROBE: did the shared elements find each other, and did they fly.
//
// A morph that does not pair fails SILENTLY. There is no error, no attribute,
// no animation and no console line — the element simply appears where it
// belongs, and the navigation looks exactly like one that never had a shared
// element. Every investigation into one therefore started by building a
// private tracer to answer a single question, and ended by deleting it.
//
// The question is answerable from the DOM as long as the pairing key is in it,
// which is why `data-flemo-morph-id` exists. This probe groups the registered
// ends by that key, notes which of them the runtime stamped with a flight role,
// and reports the difference: a pair that had everything it needed and did not
// fly.
//
// A ROLE IS THE PROOF. Both ends are stamped "enter"/"exit" for the flight's
// duration, so one role sighting settles it — the probe never has to guess from
// geometry or from an animation it might have missed.

/** A ghost cut this soon after it appeared was never seen. */
export const GHOST_BLADE_MS = 34;

const ROLE_SELECTOR = MORPH_ROLES.map((role) => `[${MORPH_ATTR}="${role}"]`).join(",");
const SCREEN_SELECTOR = attrSelector(SCREEN_ATTR);

const round1 = (value: number) => Math.round(value * 10) / 10;

export interface MorphProbeState {
  /** Registered ends seen when the flight opened. */
  registered: number;
  /** Keys with ends this flight could have paired. */
  pairable: Set<string>;
  /** Keys carried by more than one end inside a single screen. */
  duplicated: Set<string>;
  /** Keys seen carrying a flight role at any point during the flight. */
  flew: Set<string>;
  camera: boolean;
  /** Ghosts seen, and when each appeared, so a cut one can be timed. */
  ghosts: number;
  ghostBornAt: Map<Element, number>;
  shortestGhostLifeMs: number | null;
  /** Morph keyframe rules in the sheet when the flight opened. */
  sheetRulesAtStart: number;
}

const keyOf = (element: Element): string | null => {
  const key = element.getAttribute(MORPH_ID_ATTR);
  return key === null || key === "" ? null : key;
};

const isFlying = (element: Element): boolean => {
  const role = element.getAttribute(MORPH_ATTR);
  return role !== null && (MORPH_ROLES as readonly string[]).includes(role);
};

/**
 * Morph keyframe rules currently in the per-flight sheet.
 *
 * One `<style>` element holds them all and outlives every flight, so counting
 * the element proves nothing; the rules are what a flight inserts and drops.
 * A landing that leaves more than it started with leaked a flight's keyframes.
 */
export const morphSheetRuleCount = (): number => {
  try {
    const tag = document.querySelector<HTMLStyleElement>(`style[${MORPH_SHEET_ATTR}]`);
    return tag?.sheet?.cssRules.length ?? 0;
  } catch {
    // A sheet the document cannot read (cross-origin, or mid-teardown).
    return 0;
  }
};

/**
 * Read the pairing picture as the flight opens.
 *
 * By this point the runtime has already staged whatever it paired: the
 * observer that opens a flight runs after the commit that stamped the roles.
 * So a role is read as fact, and only the ends still sitting in their screens
 * are grouped to decide what COULD have paired.
 *
 * Ends are grouped by owning screen because two ends under one screen are not
 * a pair — they are the same key used twice, which is a consumer mistake worth
 * naming rather than a runtime failure. Ends outside any screen (shared chrome:
 * a bar rendered beside the screen scope, not inside it) count as their own
 * owner, which is the runtime's own rule for them.
 */
export const createMorphProbeState = (participants: readonly Element[]): MorphProbeState => {
  const state: MorphProbeState = {
    registered: 0,
    pairable: new Set(),
    duplicated: new Set(),
    flew: new Set(),
    camera: document.querySelector(attrSelector(MORPH_CAMERA_ATTR)) !== null,
    ghosts: 0,
    ghostBornAt: new Map(),
    shortestGhostLifeMs: null,
    sheetRulesAtStart: morphSheetRuleCount()
  };
  const inFlight = new Set(participants);
  /** key -> owning screens (null modelled as the element itself: chrome is its own owner). */
  const owners = new Map<string, Set<Element | null>>();
  const perOwner = new Map<string, Map<Element | null, number>>();
  for (const element of Array.from(document.querySelectorAll(attrSelector(MORPH_ATTR)))) {
    state.registered += 1;
    const key = keyOf(element);
    if (key === null) continue;
    if (isFlying(element)) {
      state.flew.add(key);
      continue;
    }
    const screen = element.closest(SCREEN_SELECTOR);
    // Only ends this flight could actually have used: one of its own screens,
    // or chrome that belongs to no screen at all. A morph sitting in a deep
    // resting screen shares nothing with this navigation.
    if (screen !== null && !inFlight.has(screen)) continue;
    const owner = screen;
    let set = owners.get(key);
    if (!set) owners.set(key, (set = new Set()));
    set.add(owner);
    let counts = perOwner.get(key);
    if (!counts) perOwner.set(key, (counts = new Map()));
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  for (const [key, set] of owners) {
    if (set.size >= 2) state.pairable.add(key);
    const counts = perOwner.get(key);
    if (counts && [...counts.values()].some((count) => count > 1)) state.duplicated.add(key);
  }
  return state;
};

/** A role stamped (or cleared) during the flight: proof the pair flew. */
export const trackMorphAttribute = (state: MorphProbeState, target: Element): void => {
  if (target.hasAttribute(MORPH_CAMERA_ATTR)) state.camera = true;
  if (!isFlying(target)) return;
  const key = keyOf(target);
  if (key !== null) state.flew.add(key);
};

/** Ghosts arriving and leaving, so one cut inside a frame can be timed. */
export const trackMorphNodes = (
  state: MorphProbeState,
  mutation: MutationRecord,
  atMs: number
): void => {
  for (const node of Array.from(mutation.addedNodes)) {
    if (!(node instanceof Element)) continue;
    for (const ghost of ghostsIn(node)) {
      if (state.ghostBornAt.has(ghost)) continue;
      state.ghosts += 1;
      state.ghostBornAt.set(ghost, atMs);
    }
  }
  for (const node of Array.from(mutation.removedNodes)) {
    if (!(node instanceof Element)) continue;
    for (const ghost of ghostsIn(node)) {
      const born = state.ghostBornAt.get(ghost);
      if (born === undefined) continue;
      state.ghostBornAt.delete(ghost);
      const life = atMs - born;
      if (state.shortestGhostLifeMs === null || life < state.shortestGhostLifeMs) {
        state.shortestGhostLifeMs = life;
      }
    }
  }
};

const ghostsIn = (node: Element): Element[] => {
  const found = node.hasAttribute(MORPH_GHOST_ATTR) ? [node] : [];
  return [...found, ...Array.from(node.querySelectorAll(attrSelector(MORPH_GHOST_ATTR)))];
};

/**
 * Tripwire hits the morph probe raises, at the moment they can be judged.
 *
 * A ghost is a copy of the element being replaced and its whole job is to be
 * seen fading; one removed within a frame of appearing was never on screen at
 * all, which is the first-frame blade this project spent a campaign on.
 */
export const morphTripwires = (state: MorphProbeState): TripwireHit[] => {
  const life = state.shortestGhostLifeMs;
  if (life === null || life >= GHOST_BLADE_MS) return [];
  return [
    {
      kind: "ghost-cut",
      atMs: round1(life),
      detail:
        `a morph ghost was removed ${round1(life)}ms after it was created (under one frame) — ` +
        "the departing content it stands for was never presented; this is the first-frame " +
        "blade signature"
    }
  ];
};

/** The flight's morph picture, plus what it left behind at rest. */
export const morphActivity = (state: MorphProbeState, busy: boolean): MorphActivity => {
  const pairable = [...state.pairable].sort();
  const flew = [...state.flew].sort();
  const flown = new Set(flew);
  const residue = busy
    ? { strandedRoles: 0, strandedStandIns: 0, strandedGhosts: 0, layerResidue: 0, leaked: 0 }
    : {
        strandedRoles: document.querySelectorAll(ROLE_SELECTOR).length,
        strandedStandIns: document.querySelectorAll(attrSelector(MORPH_STAND_IN_ATTR)).length,
        strandedGhosts: document.querySelectorAll(attrSelector(MORPH_GHOST_ATTR)).length,
        layerResidue: Array.from(document.querySelectorAll(attrSelector(MORPH_LAYER_ATTR))).reduce(
          (total, layer) => total + layer.childElementCount,
          0
        ),
        leaked: Math.max(0, morphSheetRuleCount() - state.sheetRulesAtStart)
      };
  return {
    registered: state.registered,
    pairable,
    flew,
    skipped: pairable.filter((key) => !flown.has(key)),
    camera: state.camera,
    ghosts: state.ghosts,
    strandedRoles: residue.strandedRoles,
    strandedStandIns: residue.strandedStandIns,
    strandedGhosts: residue.strandedGhosts,
    leakedSheetRules: residue.leaked,
    layerResidue: residue.layerResidue,
    duplicatedKeys: [...state.duplicated].sort()
  };
};
