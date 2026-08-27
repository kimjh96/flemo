"use client";

import { Route, Router, Screen, Slot } from "@flemo/react";

import LayerScreen from "../../_screens/LayerScreen";

import "./LayerRouter.types";

// The nested arrangement the layering rule is about: an OUTER screen owns the
// region and declares nothing of its own, and the transitions happen in a
// Router mounted inside it. A nested Router contains its screens to that box
// rather than the viewport, which is what turned a shared bar into something a
// consumer's `position: fixed` sheet could not reach.
function LayerStack() {
  return (
    <Router
      name="layer"
      initPath="/playground/layer/list"
      history="memory"
      defaultTransitionName="cupertino"
      className="h-full w-full bg-[var(--color-bg)]"
    >
      <Slot className="h-full w-full">
        <Route path="/playground/layer/list" element={<LayerScreen />} />
        <Route path="/playground/layer/detail" element={<LayerScreen />} />
      </Slot>
    </Router>
  );
}

function LayerRouter() {
  return (
    <Router
      initPath="/playground/layer"
      history="memory"
      defaultTransitionName="none"
      className="h-full w-full"
    >
      <Slot className="h-full w-full">
        <Route
          path="/playground/layer"
          element={
            <Screen>
              <LayerStack />
            </Screen>
          }
        />
      </Slot>
    </Router>
  );
}

export default LayerRouter;
