import {
  builtInSpec,
  specOf,
  type TransitionSpec
} from "@/app/[lang]/_components/TransitionReadout";

import aperture from "../_transitions/aperture";
import drift from "../_transitions/drift";
import reveal from "../_transitions/reveal";
import sheet from "../_transitions/sheet";
import tether from "../_transitions/tether";

// The clock and curve each bench case pushes on, read from the definitions the
// bench registers, for the readout under the stage.
const AUTHORED: Record<string, TransitionSpec> = {
  reveal: specOf(reveal),
  drift: specOf(drift),
  sheet: specOf(sheet),
  tether: specOf(tether),
  aperture: specOf(aperture)
};

export function benchSpec(transition: string): TransitionSpec | null {
  return AUTHORED[transition] ?? builtInSpec(transition);
}
