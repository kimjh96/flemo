"use client";

import { Morph, Screen, useNavigate } from "@flemo/react";

import Icon from "@/components/Icon";
import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import MiniArtwork from "../../_components/MiniArtwork";
import MiniTopBar from "../../_components/MiniTopBar";
import { PLACE_IDS } from "../../_data/places";
import { useMini } from "../../_providers/MiniContext";

function MiniListScreen() {
  const { push } = useNavigate();
  const { morph, part } = useMini();
  const t = useShellDict().mini;

  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--bg)"
      sharedTopBar={
        part ? (
          <MiniTopBar
            title={t.title}
            action={
              <span className="grid size-7 place-items-center rounded-full bg-accent text-micro font-semibold text-accent-fg">
                JH
              </span>
            }
          />
        ) : undefined
      }
      sharedTopBarId={part ? "mini-bar" : undefined}
    >
      <div className="no-scrollbar h-full overflow-y-auto px-3 pb-4">
        {!part && (
          <div className="px-2 pt-6 pb-3">
            <p className="text-[1.375rem] font-semibold tracking-[-0.03em] text-fg">{t.title}</p>
            <p className="text-xs text-fg-subtle">{t.subtitle}</p>
          </div>
        )}
        <ul className={`flex flex-col gap-1 ${part ? "pt-3" : ""}`}>
          {PLACE_IDS.map((id) => {
            // Inside a Morph the picture fills the Morph's box, so it follows the box
            // as it grows into the detail hero and shrinks back from it on a pop.
            const art = (
              <MiniArtwork place={id} className={morph ? "size-full" : "size-12 rounded-md"} />
            );
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => push("/mini/:id", { id })}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-2"
                >
                  {morph ? (
                    <Morph
                      layoutId={`mini-art-${id}`}
                      className="size-12 shrink-0 overflow-hidden rounded-md"
                    >
                      {art}
                    </Morph>
                  ) : (
                    art
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {t.places[id]}
                    </span>
                    <span className="block truncate text-xs text-fg-subtle">{t.countries[id]}</span>
                  </span>
                  <Icon name="chevronRight" size={14} className="text-fg-subtle" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Screen>
  );
}

export default MiniListScreen;
