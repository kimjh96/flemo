"use client";

import { Route, Router, Slot } from "@flemo/react";

import Crumb from "../../_components/Crumb";
import StackReadout from "../../_components/StackReadout";

import crumb from "../../_transitions/crumb";
import fade from "../../_transitions/fade";

import BrowseTab from "../../_screens/BrowseTab";
import SavedTab from "../../_screens/SavedTab";

import TransitionChoiceContext, {
  type PlaygroundChoice
} from "../../_providers/TransitionChoiceContext";

import "./AppRouter.types";

const TRANSITIONS = [fade];
const PART_TRANSITIONS = [crumb];

export interface AppRouterProps {
  choice: PlaygroundChoice;
}

// THE FIXTURE APP, one Router deep, with a second one inside it.
//
// The composition is the point. Nothing here is a feature laid out beside
// another feature: the tab bar is a SHARED bar declared by both tab screens, so
// it holds still while the tabs cross-fade under it; the Browse tab is a screen
// that contains a whole Router of its own, so a push in there deepens a stack
// the tab bar knows nothing about; the crumb is a <Part> living OUTSIDE this
// Slot, so it is never unmounted by a navigation and still runs on the
// navigation's clock; and each Router prints its own state under the frame,
// which is what makes "nested" mean something you can watch rather than read.
//
// The bench's transition and morph switches drive the INNER stack. The tabs
// keep their own fade, because a tab switch is not the thing being compared.
function AppRouter({ choice }: AppRouterProps) {
  return (
    <TransitionChoiceContext.Provider value={choice}>
      <Router
        initPath="/studio/browse"
        history="memory"
        transitions={TRANSITIONS}
        partTransitions={PART_TRANSITIONS}
        defaultTransitionName="fade"
        className="h-full w-full bg-[var(--color-bg)]"
      >
        <div className="flex h-full w-full flex-col">
          <Slot className="min-h-0 flex-1">
            <Route path="/studio/browse" element={<BrowseTab />} />
            <Route path="/studio/saved" element={<SavedTab />} />
          </Slot>
          <Crumb />
          <StackReadout label="outer" />
        </div>
      </Router>
    </TransitionChoiceContext.Provider>
  );
}

export default AppRouter;
