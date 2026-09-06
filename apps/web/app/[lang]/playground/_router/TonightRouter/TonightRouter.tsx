"use client";

import { Route, Router, Slot } from "@flemo/react";

import sharedAxisBackward from "@/app/[lang]/_transitions/sharedAxisBackward";
import sharedAxisForward from "@/app/[lang]/_transitions/sharedAxisForward";

import aperture from "../../_transitions/aperture";
import drift from "../../_transitions/drift";
import cardBody from "../../_transitions/cardBody";
import cardChrome from "../../_transitions/cardChrome";
import detailChromes from "../../_transitions/detailChrome";
import sheet from "../../_transitions/sheet";
import tether from "../../_transitions/tether";
import recess from "../../_transitions/recess";
import reveal from "../../_transitions/reveal";

import ActScreen from "../../_screens/ActScreen";
import ActsScreen from "../../_screens/ActsScreen";
import PostersScreen from "../../_screens/PostersScreen";
import TicketsScreen from "../../_screens/TicketsScreen";

import BenchContext, { type BenchCase } from "../../_providers/BenchContext";

import "./TonightRouter.types";

export interface TonightRouterProps {
  bench: BenchCase;
}

// The mini-app. A NESTED <Router> with in-memory history, exactly as the
// author's own wallet and music demos are built: local stack, no browser URL,
// no back-button entanglement with the site around it.
//
// What it puts on show, and nothing more:
//
//   Tonight <-> Tickets   peers. Both declare the same shared bottom bar, so
//                         the bar HOLDS while the tabs move laterally.
//   Tonight -> Act        a push carrying one shared element. The detail
//                         declares no bar, so the bar RIDES out and back.
//
// The bench switches which transition carries that push. The screens do not
// branch on it — with one exception the deleted playground's clocks.ts already
// paid for: the detail's floating header is covered by the artwork's flight
// and revealed at the landing, so its entrance has to carry the flight's own
// clock, and a part authors literal durations. detailChrome.ts writes one part
// per case for exactly that element, and nothing else reads the case name.
//
// `<Slot>` is required rather than decorative: the Router has a non-Route child
// (the bench provider's subtree would be one too), and the docs are explicit:
// "If a Router has children that are not Routes ... wrap the routes in a Slot
// so flemo can tell screens from the surrounding layout."
function TonightRouter({ bench }: TonightRouterProps) {
  return (
    <BenchContext.Provider value={bench}>
      <Router
        initPath="/tonight"
        history="memory"
        transitions={[
          reveal,
          drift,
          sheet,
          tether,
          aperture,
          sharedAxisForward,
          sharedAxisBackward
        ]}
        // `drift` names this one. A decorator is registered by the Router, not
        // by the transition that asks for it.
        decorators={[recess]}
        // The reference recipe in full: the card's ghost covers the surface
        // hand-over, and the page's own copy rides these two parts, body copy
        // arriving late and leaving early, chrome late in both directions.
        partTransitions={[cardBody, cardChrome, ...detailChromes]}
        defaultTransitionName="cupertino"
        className="h-full w-full bg-[var(--color-bg)]"
      >
        <Slot className="h-full w-full">
          <Route path="/tonight" element={<ActsScreen />} />
          <Route path="/tonight/posters" element={<PostersScreen />} />
          <Route path="/tonight/tickets" element={<TicketsScreen />} />
          <Route path="/tonight/act/:id" element={<ActScreen />} />
        </Slot>
      </Router>
    </BenchContext.Provider>
  );
}

export default TonightRouter;
