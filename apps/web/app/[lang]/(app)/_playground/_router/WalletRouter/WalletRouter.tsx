"use client";

import { Route, Router, Slot } from "@flemo/react";

import sharedAxisBackward from "@/app/[lang]/(app)/_transitions/sharedAxisBackward";
import sharedAxisForward from "@/app/[lang]/(app)/_transitions/sharedAxisForward";

import WalletTabBar from "../../_components/WalletTabBar";
import WalletActivityScreen from "../../_screens/WalletActivityScreen";
import WalletDetailScreen from "../../_screens/WalletDetailScreen";
import WalletHomeScreen from "../../_screens/WalletHomeScreen";

import "./WalletRouter.types";

// The wallet demo: a NESTED <Router> (local in-memory history, no browser URL)
// running inside the landing hero. The tab bar persists below the <Slot>; the
// screens transition inside it. Home <-> Activity are peers (shared-axis); a row
// pushes the detail (cupertino, swipe-back); the send sheet rides on <Layer>.
// One demo exercising every transition kind flemo ships.
function WalletRouter() {
  return (
    <Router
      initPath="/wallet/home"
      transitions={[sharedAxisForward, sharedAxisBackward]}
      className="flex h-full w-full flex-col bg-[var(--color-bg)]"
    >
      <Slot className="min-h-0 grow">
        <Route path="/wallet/home" element={<WalletHomeScreen />} />
        <Route path="/wallet/activity" element={<WalletActivityScreen />} />
        <Route path="/wallet/tx/:id" element={<WalletDetailScreen />} />
      </Slot>
      <WalletTabBar />
    </Router>
  );
}

export default WalletRouter;
