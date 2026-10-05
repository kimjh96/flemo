"use client";

import { Morph, Screen, useNavigate } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import MiniArtwork from "../../_components/MiniArtwork";
import MiniTopBar from "../../_components/MiniTopBar";
import PanelRouter from "../../_router/PanelRouter";

// The app's home: the shared header, a featured place that grows into its own
// screen, and below it the panel with its own Router.
//
// The featured card sits in this screen, not inside the panel. A Morph pairs
// only with Morphs on screens of the same Router, and inside the panel it
// would belong to the panel's Router rather than the app's.
function TripHomeScreen() {
  const { push } = useNavigate();
  const t = useShellDict().mini;

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--bg)"
      sharedTopBar={
        <MiniTopBar
          title={t.title}
          action={
            <span className="grid size-7 place-items-center rounded-full bg-accent text-micro font-semibold text-accent-fg">
              JH
            </span>
          }
        />
      }
      sharedTopBarId="trip-bar"
      contentScrollable={false}
    >
      <div className="flex h-full flex-col gap-3 px-3 pt-3 pb-3">
        <button
          type="button"
          onClick={() => push("/trip/:id", { id: "kyoto" })}
          className="block w-full text-left"
        >
          <span className="block px-1 pb-1.5 text-xs text-fg-subtle">{t.trip.featured}</span>
          <Morph layoutId="trip-art-kyoto" className="h-24 w-full overflow-hidden rounded-lg">
            <MiniArtwork place="kyoto" className="size-full" />
          </Morph>
          <span className="mt-2 flex items-baseline justify-between px-1">
            <span className="text-sm font-semibold text-fg">{t.places.kyoto}</span>
            <span className="text-xs text-fg-subtle">{t.countries.kyoto}</span>
          </span>
        </button>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
          <PanelRouter />
        </div>
      </div>
    </Screen>
  );
}

export default TripHomeScreen;
