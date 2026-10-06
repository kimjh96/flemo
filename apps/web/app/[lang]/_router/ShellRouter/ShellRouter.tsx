"use client";

import { FlemoDevtools } from "@flemo/devtools/react";
import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import SiteHeader from "@/app/[lang]/_components/SiteHeader";
import HomeScreen from "@/app/[lang]/_screens/HomeScreen";
import DocsSearch from "@/app/[lang]/docs/_components/DocsSearch";
import DocsScreen from "@/app/[lang]/docs/_screens/DocsScreen";
import PlaygroundScreen from "@/app/[lang]/playground/_screens/PlaygroundScreen";
import CompositionPlaygroundScreen from "@/app/[lang]/playground/_screens/CompositionPlaygroundScreen";
import ShowcaseScreen from "@/app/[lang]/showcase/_screens/ShowcaseScreen";
import siteBackward from "@/app/[lang]/_transitions/siteBackward";
import siteDrill from "@/app/[lang]/_transitions/siteDrill";
import siteForward from "@/app/[lang]/_transitions/siteForward";

import "./ShellRouter.types";

export interface ShellRouterProps {
  // The unprefixed path this page maps to, passed from the server so the Router
  // server-renders the right screen (no blank frame on load).
  initPath: string;
}

// The site is one flemo app. ONE root <Router> owns every section; the header
// sits OUTSIDE the <Slot>, so it stays mounted while only the region under it
// moves. Header taps are lateral peer moves (site-forward / site-backward);
// a call to action that goes deeper shoves the page a full width (site-drill),
// on a phone too.
//
// The <Slot> fills the viewport and every screen scrolls inside it, under the
// translucent header: the app-shell layout, where chrome is pinned and the
// content area moves as a unit.
function ShellRouter({ initPath }: ShellRouterProps) {
  const getLocale = useShellLocaleGetter();

  return (
    <Router
      initPath={initPath}
      createDriver={(key) => createLocaleHistoryDriver(key, getLocale)}
      defaultTransitionName="site-forward"
      transitions={[siteForward, siteBackward, siteDrill]}
    >
      {/*
        Outside the <Slot>, so it outlives every screen and records the transitions
        of every route. Unconditional, because `@flemo/devtools/react` resolves
        to a component that renders null and imports nothing in a production
        build; `e2e/devtools-production.spec.ts` is what says so.
      */}
      <FlemoDevtools />
      <div className="relative h-[100dvh] overflow-hidden bg-bg">
        <SiteHeader />
        <DocsSearch />
        <Slot className="h-full w-full">
          <Route path="/" element={<HomeScreen />} />
          <Route path={["/docs", "/docs/:slug"]} element={<DocsScreen />} />
          <Route path="/playground" element={<PlaygroundScreen />} />
          <Route path="/playground/composition" element={<CompositionPlaygroundScreen />} />
          <Route path="/showcase" element={<ShowcaseScreen />} />
        </Slot>
      </div>
    </Router>
  );
}

export default ShellRouter;
