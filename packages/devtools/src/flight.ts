import type { FrameProbeState } from "./frameProbe";
import type { ImageProbeState } from "./imageProbe";
import type { MorphProbeState } from "./morphProbe";
import type { FlightKind, FlightRecord, TripwireHit } from "./types";

/**
 * The mutable state of one flight while it is in the air.
 *
 * Composed of one field per probe rather than a flat bag: every probe owns its
 * own state shape, the orchestrator owns only the lifecycle fields, and adding
 * a measurement means adding a field and a module beside it rather than
 * growing a closure nobody can hold in their head.
 */
export interface ActiveFlight {
  id: string;
  kind: FlightKind;
  routerId?: string;
  /** The comparison bucket armed when this flight opened, if any. */
  bucket: string | null;
  t0Ms: number;
  t0Iso: string;
  elements: Element[];
  participants: FlightRecord["participants"];
  holdKind: string | null;
  holdReleasedAtMs: number | null;
  /**
   * When the first flemo keyframe actually STARTED, relative to t0.
   *
   * The status flip and the first moving frame are not the same moment: a
   * commit, a style recalculation and a present sit between them, and on a
   * phone that gap has measured 90-165ms while every other number stayed
   * clean. It is reported rather than judged, because the gap is React's and
   * the browser's, not the transition's.
   */
  firstAnimationAtMs: number | null;
  frames: FrameProbeState;
  images: ImageProbeState;
  morphs: MorphProbeState;
  tripwires: TripwireHit[];
  rafId: number | null;
}
