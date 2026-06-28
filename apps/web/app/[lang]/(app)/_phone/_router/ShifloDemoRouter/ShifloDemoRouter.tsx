"use client";

import { Route, Router, Slot } from "@flemo/react";

import sharedAxisBackward from "@/app/[lang]/(app)/_transitions/sharedAxisBackward";
import sharedAxisForward from "@/app/[lang]/(app)/_transitions/sharedAxisForward";

import ShotDots from "../../_components/ShotDots";
import { SHOT_ASPECT } from "../../_data/shifloShots";
import ShotScreen from "../../_screens/ShotScreen";

import "./ShifloDemoRouter.types";

// The hero's shiflo viewer: a NESTED <Router> (depth > 0), so it runs a local
// in-memory history and never touches the browser URL — its own self-contained
// transition region living inside the landing screen. The shots transition in
// the <Slot>; the page dots persist below them. This is the inner layer of the
// shell's dogfooding: root Router + Slot for the site, a nested Router here for
// the phone, one demo proving both.
function ShifloDemoRouter() {
  return (
    <Router
      initPath="/shiflo-shot/1"
      transitions={[sharedAxisForward, sharedAxisBackward]}
      className="rounded-[36px] border border-[var(--color-border)] bg-[var(--color-layer)] shadow-[0_24px_60px_-28px_rgba(15,19,27,0.4)]"
      style={{ aspectRatio: SHOT_ASPECT }}
    >
      <Slot style={{ position: "absolute", inset: 0 }}>
        <Route path="/shiflo-shot/:n" element={<ShotScreen />} />
      </Slot>
      <ShotDots />
    </Router>
  );
}

export default ShifloDemoRouter;
