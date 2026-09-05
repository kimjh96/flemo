"use client";

import { FlemoDevtools } from "@flemo/devtools/react";
import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import SiteHeader from "@/app/[lang]/_components/SiteHeader";
import HomeScreen from "@/app/[lang]/_screens/HomeScreen";
import PlaygroundScreen from "@/app/[lang]/playground/_screens/PlaygroundScreen";
import DocsScreen from "@/app/[lang]/docs/_screens/DocsScreen";
import ShowcaseScreen from "@/app/[lang]/showcase/_screens/ShowcaseScreen";
import docsEnter from "@/app/[lang]/_transitions/docsEnter";
import sharedAxisBackward from "@/app/[lang]/_transitions/sharedAxisBackward";
import sharedAxisForward from "@/app/[lang]/_transitions/sharedAxisForward";

import "./ShellRouter.types";

export interface ShellRouterProps {
  // The unprefixed path this page maps to, passed from the server so the Router
  // server-renders the right screen (no blank frame on load). On the client the
  // Router reads the address bar, which ShellApp has normalized to match.
  initPath: string;
}

// The flemo app shell. ONE root <Router> owns the whole marketing surface; the
// <SiteHeader> sits OUTSIDE the <Slot>, so it stays mounted while only the
// <Slot> region transitions between Home and Showcase. The two screens are
// peers (top-level nav, not parent/child), so the default transition is the
// lateral shared-axis slide, the header passes the forward/backward variant
// per click based on nav order.
//
// The <Slot> is sized to the viewport below the 4rem header; each screen
// scrolls inside it, the native app-shell layout where the chrome is pinned and
// the content area moves as a unit.
function ShellRouter({ initPath }: ShellRouterProps) {
  const getLocale = useShellLocaleGetter();

  return (
    <Router
      initPath={initPath}
      createDriver={(key) => createLocaleHistoryDriver(key, getLocale)}
      defaultTransitionName="shared-axis-forward"
      transitions={[sharedAxisForward, sharedAxisBackward, docsEnter]}
    >
      {/*
        OUTSIDE THE <Slot>, so it outlives every screen.

        It used to render inside PlaygroundScreen, which meant it existed only
        while that one screen was mounted: navigate to Docs and the recorder
        went with it, taking the flights of every other route on this site with
        it too. Those are exactly the flights worth watching here, since the
        docs entry and the header's own navigations are what past rounds
        measured.

        Unconditional, because `@flemo/devtools/react` resolves to a component
        that renders null and imports nothing in a production build. There is
        no guard to get wrong; `e2e/devtools-production.spec.ts` is what says so.
      */}
      <FlemoDevtools />
      {/* The header overlays the content (absolute, z-40), so screens scroll
          UNDER its frosted glass, real glassmorphism, no seam. */}
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--color-bg)]">
        <SiteHeader />
        <Slot className="h-full w-full">
          <Route path="/" element={<HomeScreen />} />
          <Route path="/showcase" element={<ShowcaseScreen />} />
          <Route path="/playground" element={<PlaygroundScreen />} />
          <Route path={["/docs", "/docs/:slug"]} element={<DocsScreen />} />
        </Slot>
      </div>
    </Router>
  );
}

export default ShellRouter;
