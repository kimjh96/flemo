"use client";

import { Route, Router, Slot } from "@flemo/react";

import sharedAxisBackward from "@/app/[lang]/_transitions/sharedAxisBackward";
import sharedAxisForward from "@/app/[lang]/_transitions/sharedAxisForward";

import WalletAutoPlay from "../../_components/WalletAutoPlay";
import WalletActivityScreen from "../../_screens/WalletActivityScreen";
import WalletDetailScreen from "../../_screens/WalletDetailScreen";
import WalletHomeScreen from "../../_screens/WalletHomeScreen";
import WalletSendScreen from "../../_screens/WalletSendScreen";

import "./WalletRouter.types";

export interface WalletRouterProps {
  autoPlay?: boolean;
}

// The wallet demo: a NESTED <Router> (local in-memory history, no browser URL)
// running inside the landing hero, exercising flemo's headline features:
//   - Home <-> Activity: peers, a shared-axis move. Both declare the same
//     `sharedBottomBar`, so the tab bar stays PINNED across them.
//   - Row -> Detail: a cupertino push. Detail has no bar, so the shared tab bar
//     animates away, the shared-bar present/absent transition.
//   - Send: a material vertical rise, also barless, a third transition kind.
// WalletAutoPlay drives this loop on its own while the visitor is idle.
function WalletRouter({ autoPlay = false }: WalletRouterProps) {
  return (
    <Router
      initPath="/wallet/home"
      history="memory"
      transitions={[sharedAxisForward, sharedAxisBackward]}
      className="h-full w-full bg-[var(--color-bg)]"
    >
      <Slot className="h-full w-full">
        <Route path="/wallet/home" element={<WalletHomeScreen />} />
        <Route path="/wallet/activity" element={<WalletActivityScreen />} />
        <Route path="/wallet/tx/:id" element={<WalletDetailScreen />} />
        <Route path="/wallet/send" element={<WalletSendScreen />} />
      </Slot>
      <WalletAutoPlay active={autoPlay} />
    </Router>
  );
}

export default WalletRouter;
