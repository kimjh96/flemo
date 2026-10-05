"use client";

import { Route, Router } from "@flemo/react";

import PanelFiltersScreen from "../../_screens/PanelFiltersScreen";
import PanelSavedScreen from "../../_screens/PanelSavedScreen";

// The panel's own stack. Moving between its pages animates only this box; the
// app's header and the app's stack stay where they are.
function PanelRouter() {
  return (
    <Router name="panel" initPath="/panel" history="memory" className="h-full w-full">
      <Route path="/panel" element={<PanelSavedScreen />} />
      <Route path="/panel/filters" element={<PanelFiltersScreen />} />
    </Router>
  );
}

export default PanelRouter;
