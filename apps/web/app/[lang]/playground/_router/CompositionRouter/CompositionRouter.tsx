"use client";

import { Route, Router } from "@flemo/react";

import CompositionDetailScreen from "../../_screens/CompositionDetailScreen";
import CompositionWorkspaceScreen from "../../_screens/CompositionWorkspaceScreen";
import compositionCardParts, { compositionCardShell } from "../../_transitions/compositionCard";
import compositionHeaderParts from "../../_transitions/compositionHeader";

import "./CompositionRouter.types";

function CompositionRouter() {
  return (
    <Router
      name="composition-app"
      history="memory"
      initPath="/composition-home"
      defaultTransitionName="cupertino"
      partTransitions={[...compositionHeaderParts, ...compositionCardParts]}
      morphTransitions={[compositionCardShell]}
      className="h-full w-full bg-[var(--color-bg)]"
      strictRoutes
    >
      <Route path="/composition-home" element={<CompositionWorkspaceScreen />} />
      <Route path="/composition-detail/:id" element={<CompositionDetailScreen />} />
    </Router>
  );
}

export default CompositionRouter;
