"use client";

import { Screen, useNavigate, useParams, useStep } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import Shared from "../../_components/Shared";
import StageBar from "../../_components/StageBar";

import { useTransitionChoice } from "../../_providers/TransitionChoiceContext";

import { PIECES, surfaceFor } from "../../_data/gallery";

// The source side of the fixture: a grid of CARDS, each one a nest of shared
// elements — the card itself, the artwork inside it, and the title inside that.
// All three are paired across the flight, so this is the container case, the
// element case and the nested case in one screen.
//
// It also carries two things that are not about morphing at all, because a
// fixture that only exercises one feature is not a fixture for the library:
//
// - `sharedTopBar`, under an ID the detail screen repeats. A shared bar is kept
//   out of the screen transition, so it holds still while the screens move
//   under it and simply changes what it says.
// - A filter panel opened with `useStep`. A step is a sub-state pushed onto
//   history WITHOUT stacking a screen, which is what makes the browser's Back
//   button close it — the thing every hand-rolled modal gets wrong.
function GalleryScreen() {
  const { push } = useNavigate();
  const { transition, morph } = useTransitionChoice();
  const t = getDict(useShellLang()).playground;
  // The step's state is the SCREEN's params: `useStep` pushes and pops it,
  // `useParams` reads it back. (`useStep`'s own `step` is the chrome path, for
  // an overlay rendered outside any screen.)
  const { pushStep, popStep } = useStep<"/playground/gallery">();
  const params = useParams<"/playground/gallery">();
  const filterOpen = Boolean(params?.filter);

  return (
    <Screen
      backgroundColor="var(--color-bg)"
      sharedTopBarId="stage"
      sharedTopBar={
        <StageBar
          title={t.gallery.title}
          trail={
            <button
              type="button"
              onClick={() => (filterOpen ? popStep() : pushStep({ filter: true }))}
              aria-expanded={filterOpen}
              className="cursor-pointer rounded-full px-3 py-1 font-mono text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-layer)]"
            >
              {t.demo.filter}
            </button>
          }
        />
      }
    >
      <div className="relative h-full">
        <div className="h-full overflow-y-auto px-5 pt-4 pb-10">
          <p className="text-sm text-[var(--color-text-disabled)]">
            {morph.name ? t.gallery.hintShared : t.gallery.hintPlain}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-4">
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

        {filterOpen ? (
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[var(--color-border)] bg-[var(--color-layer)] p-5 shadow-[0_-18px_40px_-24px_rgba(15,23,42,0.4)]">
            <h3 className="text-base font-extrabold text-[var(--color-text-primary)]">
              {t.demo.filterTitle}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {t.demo.filterBody}
            </p>
            <button
              type="button"
              onClick={() => popStep()}
              className="mt-4 cursor-pointer rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              {t.demo.filterClose}
            </button>
          </div>
        ) : null}
      </div>
    </Screen>
  );
}

export default GalleryScreen;
