"use client";

import { Part, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import Shared from "../../_components/Shared";
import StageScreen from "../../_components/StageScreen";
import StageBar from "../../_components/StageBar";

import { useTransitionChoice } from "../../_providers/TransitionChoiceContext";

import { PIECES, pieceById, surfaceFor } from "../../_data/gallery";

// The destination side. The same three `layoutId`s, at the sizes they belong at
// here: the card fills the screen, the artwork becomes the hero, the title
// becomes the heading. Nothing here is morph-aware beyond those three props —
// no wrapper screen, no transition requirement.
function PieceScreen() {
  const navigate = useNavigate();
  const params = useParams<"/browse/piece/:id">();
  const piece = pieceById(params?.id ?? "1");
  // The "element becomes the whole screen" case: the card covers the viewport
  // edge to edge (the back button floats OVER it rather than taking a strip off
  // the top) and the screen itself paints nothing, so the receding, blurring
  // screen underneath is what shows around the element while it opens.
  const { transition, morph } = useTransitionChoice();
  const t = getDict(useShellLang()).playground;
  const fullBleed = transition.fullBleed ?? false;
  // See ChainScreen: the copy leaves early only when there is an element to
  // leave with.
  const partName = morph.name ? "detail-content" : "step-content";

  if (!piece) return null;

  // REPLACE, not push: the same slot in the stack, a different piece in it.
  // The stack readout under the frame is where it shows — the depth does not
  // move, and the back control still returns to the gallery rather than to the
  // piece that was here a moment ago.
  const nextPiece =
    PIECES[(PIECES.findIndex((entry) => entry.id === piece.id) + 1) % PIECES.length];

  const back = (
    <button
      type="button"
      onClick={() => navigate.pop()}
      aria-label="Back"
      className="grid size-8 cursor-pointer place-items-center rounded-full text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M15 6l-6 6 6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <StageScreen
      backgroundColor={fullBleed ? "transparent" : "var(--color-bg)"}
      // The bar the gallery also renders, under the same id: it holds still and
      // changes what it says instead of travelling with the screens. A
      // full-bleed case hands the whole frame to the element instead, so it
      // takes no bar at all.
      sharedTopBarId={fullBleed ? undefined : "stage"}
      sharedTopBar={
        fullBleed ? undefined : (
          <StageBar
            title={piece.title}
            lead={back}
            trail={
              nextPiece ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate.replace(
                      "/browse/piece/:id",
                      { id: nextPiece.id },
                      { transitionName: transition.id }
                    )
                  }
                  className="cursor-pointer rounded-full px-3 py-1 font-mono text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-layer)]"
                >
                  {t.demo.replace}
                </button>
              ) : null
            }
          />
        )
      }
    >
      <div className="relative flex h-full flex-col">
        <Part
          name={partName}
          hidden={!fullBleed}
          className={
            fullBleed ? "absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-4 pt-4" : "hidden"
          }
        >
          <button
            type="button"
            onClick={() => navigate.pop()}
            aria-label="Back"
            className="grid size-9 cursor-pointer place-items-center rounded-full text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="text-xs font-bold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
            {piece.place}
          </span>
        </Part>

        <div
          className={
            fullBleed
              ? "min-h-0 flex-1 overflow-y-auto"
              : "min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-10"
          }
        >
          <Shared
            layoutId={`card-${piece.id}`}
            className={
              fullBleed
                ? "block min-h-full bg-[var(--color-bg)] pb-10"
                : "overflow-hidden rounded-3xl bg-[var(--color-layer)] p-3"
            }
          >
            <button
              type="button"
              onClick={() =>
                navigate.push("/browse/viewer/:id", { id: piece.id }, { transitionName: "sheet" })
              }
              className="block w-full cursor-zoom-in"
              aria-label={t.demo.open}
            >
              <Shared
                layoutId={`art-${piece.id}`}
                className={
                  fullBleed ? "block aspect-[4/3] w-full" : "block aspect-[4/3] w-full rounded-2xl"
                }
                style={{ background: surfaceFor(piece.hue) }}
                aria-hidden="true"
              />
            </button>
            <Shared
              layoutId={`title-${piece.id}`}
              name="text"
              className={
                fullBleed
                  ? "mt-4 block px-4 text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]"
                  : "mt-4 block text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]"
              }
            >
              {piece.title}
            </Shared>
            <Part
              name={partName}
              className={
                fullBleed
                  ? "mt-2 px-4 text-sm leading-relaxed text-[var(--color-text-secondary)]"
                  : "mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]"
              }
            >
              {t.piece.body}
            </Part>
          </Shared>
        </div>
      </div>
    </StageScreen>
  );
}

export default PieceScreen;
