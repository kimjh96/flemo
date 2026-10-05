"use client";

import { Morph, Screen, useNavigate, useParams } from "@flemo/react";

import Icon from "@/components/Icon";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import MiniArtwork from "../../_components/MiniArtwork";
import MiniTopBar from "../../_components/MiniTopBar";
import { isPlaceId } from "../../_data/places";

// A place, over the whole app. Its picture is the other end of the featured
// card's Morph; a place opened from the panel has no partner on the home
// screen, so its picture simply arrives with the screen.
function TripPlaceScreen() {
  const params = useParams<"/trip/:id">();
  const navigate = useNavigate();
  const t = useShellDict().mini;
  const id = isPlaceId(params?.id) ? params.id : "kyoto";

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--bg)"
      sharedTopBar={
        <MiniTopBar
          title={t.places[id]}
          action={
            <button
              type="button"
              aria-label={t.back}
              onClick={() => navigate.pop()}
              className="grid size-8 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2"
            >
              <Icon name="arrowLeft" size={17} />
            </button>
          }
        />
      }
      sharedTopBarId="trip-bar"
    >
      <div className="no-scrollbar h-full overflow-y-auto px-3 pt-3 pb-6">
        <Morph
          layoutId={`trip-art-${id}`}
          className="aspect-[4/3] w-full overflow-hidden rounded-lg"
        >
          <MiniArtwork place={id} className="size-full" />
        </Morph>
        <div className="px-1 pt-4">
          <p className="text-xs text-fg-subtle">{t.countries[id]}</p>
          <p className="mt-0.5 text-[1.375rem] font-semibold tracking-[-0.03em] text-fg">
            {t.places[id]}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-fg-muted">{t.detailBody}</p>
          <div className="mt-4 h-9 rounded-md bg-fg text-center text-sm leading-9 font-medium text-bg">
            {t.save}
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default TripPlaceScreen;
