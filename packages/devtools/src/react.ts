import { useEffect } from "react";

import { attachDevtoolsHud } from "./hud";
import { attachDevtoolsPanel } from "./panel";

import type { DevtoolsHudOptions } from "./hud";
import type { DevtoolsPanelOptions } from "./panel";
import type { FlightRecorderHandle } from "./types";

// THE SHAPE A CONSUMER SHOULD ACTUALLY HAVE TO WRITE.
//
// `attachDevtoolsPanel` and `attachDevtoolsHud` are imperative because the
// recorder is framework-free, and that is right for the package's core. It is
// wrong for the app that just wants the instrument on screen: wiring them by
// hand meant an effect, a dynamic import, a cancellation flag, two detach
// calls, and — the part that actually bit — knowing that a plain import of
// this package is INERT in a production build, that `NODE_ENV` folds and
// `NEXT_PUBLIC_*` does not, and that `/force` exists. Every consumer would
// have had to learn all of that, and the first one to get it wrong put the
// real panel into a public bundle.
//
// So the package carries the component instead, the way a devtools package
// should:
//
//     import { FlemoDevtools } from "@flemo/devtools/react";
//     <FlemoDevtools />
//
// and a production build resolves the same specifier to a component that
// renders null and imports nothing. Nothing to remember, nothing to guard,
// nothing to strip before shipping.

export interface FlemoDevtoolsProps {
  /**
   * Recorder to read. Defaults to this package's `window.flemo` when one is
   * installed, otherwise the surfaces attach one and take it down with them.
   */
  recorder?: FlightRecorderHandle;
  /** Mount the on-device readout. Default true — it is the half a phone needs. */
  hud?: boolean;
  /** Mount the drawer. Default true. */
  panel?: boolean;
  /** Where the readout sits. Default "bottom-right", opposite the drawer's toggle. */
  hudPosition?: DevtoolsHudOptions["position"];
  /** Which corner the drawer's toggle sits in. Default "bottom-left". */
  panelPosition?: DevtoolsPanelOptions["position"];
  /** Start the drawer open. Default false. */
  initialOpen?: boolean;
  /** Labels the A/B control cycles through. Default ["A", "B"]. */
  buckets?: string[];
}

/**
 * Mount the devtools for as long as this component is rendered.
 *
 * Inert in a production build: the package's `production` export condition
 * resolves this module to one that renders null, so a consumer can leave the
 * element in their tree and ship it.
 */
export function FlemoDevtools({
  recorder,
  hud = true,
  panel = true,
  hudPosition = "bottom-right",
  panelPosition = "bottom-left",
  initialOpen = false,
  buckets
}: FlemoDevtoolsProps = {}): null {
  const bucketKey = buckets?.join("\u0000");
  // The surfaces are idempotent while mounted, so the usual case re-runs
  // nothing: a caller who passes no props at all hands the same values in on
  // every render. Listing them honestly is still better than an empty array,
  // which would silently ignore a consumer who does change one.
  useEffect(() => {
    const attached: (() => void)[] = [];
    // The recorder is resolved by the surfaces themselves (see surface.ts):
    // handed one, they read it and never detach it; handed none, the first of
    // them attaches one and the last to go takes it down.
    if (panel) {
      attached.push(
        attachDevtoolsPanel({ recorder, position: panelPosition, initialOpen, buckets }).detach
      );
    }
    if (hud) {
      attached.push(attachDevtoolsHud({ recorder, position: hudPosition, buckets }).detach);
    }
    return () => {
      // Reverse order, so a surface that owns the recorder is the last to go.
      for (const detach of attached.reverse()) detach();
    };
    // `buckets` by its CONTENT, not its identity. It is the one array prop
    // here, and a consumer writing `buckets={["A", "B"]}` inline hands in a new
    // array on every render — which through an identity dependency would
    // detach and rebuild the drawer under a user who is reading it, every
    // render, forever.
  }, [recorder, hud, panel, hudPosition, panelPosition, initialOpen, bucketKey]);

  return null;
}

export default FlemoDevtools;
