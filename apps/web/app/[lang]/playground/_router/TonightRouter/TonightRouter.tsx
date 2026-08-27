"use client";

import { Route, Router, Slot } from "@flemo/react";

import sharedAxisBackward from "@/app/[lang]/_transitions/sharedAxisBackward";
import sharedAxisForward from "@/app/[lang]/_transitions/sharedAxisForward";

import reveal from "../../_transitions/reveal";

import ActScreen from "../../_screens/ActScreen";
import ActsScreen from "../../_screens/ActsScreen";
import TicketsScreen from "../../_screens/TicketsScreen";

import BenchContext, { type Bench } from "../../_providers/BenchContext";

import "./TonightRouter.types";

export interface TonightRouterProps {
  bench: Bench;
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
// The bench switches which transition carries that push. Nothing in these
// screens knows which one it is — no screen branches on it, no part transition
// is generated for it, and no flag is set to accommodate a shared element.
//
// `<Slot>` is required rather than decorative: the Router has a non-Route child
// (the bench provider's subtree would be one too), and the docs are explicit —
// "If a Router has children that are not Routes ... wrap the routes in a Slot
// so flemo can tell screens from the surrounding layout."
function TonightRouter({ bench }: TonightRouterProps) {
  return (
    <BenchContext.Provider value={bench}>
      <Router
        initPath="/tonight"
        history="memory"
        transitions={[reveal, sharedAxisForward, sharedAxisBackward]}
        defaultTransitionName="cupertino"
        className="h-full w-full bg-[var(--color-bg)]"
      >
        <Slot className="h-full w-full">
          <Route path="/tonight" element={<ActsScreen />} />
          <Route path="/tonight/tickets" element={<TicketsScreen />} />
          <Route path="/tonight/act/:id" element={<ActScreen />} />
        </Slot>
      </Router>
    </BenchContext.Provider>
  );
}

export default TonightRouter;
