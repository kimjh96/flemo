"use client";

import { Route, Router, Slot } from "@flemo/react";

import TripAutoplay from "../../_components/TripAutoplay";
import TripHomeScreen from "../../_screens/TripHomeScreen";
import TripPlaceScreen from "../../_screens/TripPlaceScreen";
import miniBarParts from "../../_transitions/miniBar";

import "./TripRouter.types";

export interface TripRouterProps {
  autoplay: boolean;
}

// The Places app with every piece of the Putting it together page in it: a
// shared header whose title and action change as Parts, a featured card that
// grows into the place as a Morph, a panel with its own Router, and a menu the
// panel opens in a Layer.
//
// `ownsLayers` keeps that menu inside the demo. Without it the Layer host would
// be the docs page's screen and the menu would cover the whole site.
function TripRouter({ autoplay }: TripRouterProps) {
  return (
    <Router
      name="trip"
      initPath="/trip"
      history="memory"
      ownsLayers
      defaultTransitionName="cupertino"
      partTransitions={miniBarParts}
      className="h-full w-full bg-bg"
    >
      <TripAutoplay enabled={autoplay} />
      <Slot className="h-full w-full">
        <Route path="/trip" element={<TripHomeScreen />} />
        <Route path="/trip/:id" element={<TripPlaceScreen />} />
      </Slot>
    </Router>
  );
}

export default TripRouter;
