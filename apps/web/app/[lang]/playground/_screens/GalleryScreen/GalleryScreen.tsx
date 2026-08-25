"use client";

import { Screen, useNavigate } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import Shared from "../../_components/Shared";

import { useTransitionChoice } from "../../_providers/TransitionChoiceContext";

import { PIECES, surfaceFor } from "../../_data/gallery";

// The source side of the fixture: a grid of CARDS, each one a nest of morphs —
// the card itself, the artwork inside it, and the title inside that. All three
// are paired across the flight, so this is the container case, the element case
// and the nested case in one screen.
//
// Tapping a card pushes with whatever transition the strip above has selected;
// none of the morphs is told anything about that choice.
function GalleryScreen() {
  const { push } = useNavigate();
  const { transition, morph } = useTransitionChoice();
  const t = getDict(useShellLang()).playground;

  return (
    <Screen backgroundColor="var(--color-bg)">
      <div className="h-full overflow-y-auto px-5 pt-6 pb-10">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
          {t.gallery.title}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-text-disabled)]">
          {morph.name ? t.gallery.hintShared : t.gallery.hintPlain}
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-4">
          {PIECES.map((piece) => (
            <li key={piece.id}>
              <button
                type="button"
                onClick={() =>
                  push(
                    "/playground/gallery/:id",
                    { id: piece.id },
                    { transitionName: transition.id }
                  )
                }
                className="w-full cursor-pointer text-left"
              >
                <Shared
                  layoutId={`card-${piece.id}`}
                  className="block overflow-hidden rounded-2xl bg-[var(--color-layer)] p-2"
                >
                  <Shared
                    layoutId={`art-${piece.id}`}
                    className="block aspect-square w-full rounded-xl"
                    style={{ background: surfaceFor(piece.hue) }}
                    aria-hidden="true"
                  />
                  <Shared
                    layoutId={`title-${piece.id}`}
                    name="text"
                    className="mt-2 block truncate text-sm font-semibold text-[var(--color-text-primary)]"
                  >
                    {piece.title}
                  </Shared>
                </Shared>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}

export default GalleryScreen;
