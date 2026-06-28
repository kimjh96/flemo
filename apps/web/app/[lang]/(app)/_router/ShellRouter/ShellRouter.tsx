"use client";

import { Route, Router, Slot } from "@flemo/react";

import SiteHeader from "@/app/[lang]/(app)/_components/SiteHeader";
import HomeScreen from "@/app/[lang]/(app)/_screens/HomeScreen";
import ShowcaseScreen from "@/app/[lang]/(app)/_screens/ShowcaseScreen";
import sharedAxisBackward from "@/app/[lang]/(app)/_transitions/sharedAxisBackward";
import sharedAxisForward from "@/app/[lang]/(app)/_transitions/sharedAxisForward";

import "./ShellRouter.types";

// The flemo app shell. ONE root <Router> owns the whole marketing surface; the
// <SiteHeader> sits OUTSIDE the <Slot>, so it stays mounted while only the
// <Slot> region transitions between Home and Showcase. The two screens are
// peers (top-level nav, not parent/child), so the default transition is the
// lateral shared-axis slide — the header passes the forward/backward variant
// per click based on nav order.
//
// The <Slot> is sized to the viewport below the 4rem header; each screen
// scrolls inside it, the native app-shell layout where the chrome is pinned and
// the content area moves as a unit.
function ShellRouter() {
  return (
    <Router
      defaultTransitionName="shared-axis-forward"
      transitions={[sharedAxisForward, sharedAxisBackward]}
    >
      <div className="flex h-[100dvh] flex-col bg-[var(--color-bg)]">
        <SiteHeader />
        <Slot className="min-h-0 grow">
          <Route path="/" element={<HomeScreen />} />
          <Route path="/showcase" element={<ShowcaseScreen />} />
        </Slot>
      </div>
    </Router>
  );
}

export default ShellRouter;
