"use client";

import { Morph, Screen, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import { actById, artworkFor } from "../../_data/acts";

// The detail. The other half of the list row's <Morph>: the same `layoutId`, so
// the little square in the list and this one are one thing to flemo.
//
// SAME SHAPE at both ends — a square there, a square here. The docs name the
// alternative and the symptom it produces:
//
//   attachMorph.ts
//     "SHAPE, not just size. A square thumbnail becoming a 4:3 hero has to pass
//      through the ratios between, or it snaps to its destination's proportions
//      on the first frame and only the box around it grows -- which is the 'it
//      does not scale proportionally' everyone sees and nobody can name."
//
// It declares NO shared bar, so the list's tab bar rides out with the list and
// returns on the pop. Nothing here is transition-aware: no full-bleed flag, no
// transparent background, no part transitions. Whatever the bench has selected
// is carrying this screen, and this screen does not know which.
function ActScreen() {
  const navigate = useNavigate();
  const params = useParams<"/tonight/act/:id">();
  const act = actById(params?.id);
  const t = getDict(useShellLang()).playground;

  if (!act) return null;

  return (
    <Screen statusBarHeight="0px" systemNavigationBarHeight="0px" backgroundColor="var(--color-bg)">
      <div className="flex h-full flex-col px-6 pt-5 pb-8">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate.pop()}
            aria-label={t.app.back}
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
            {t.app.detail}
          </span>
          <span className="size-9" aria-hidden="true" />
        </header>

        <Morph
          layoutId={`art-${act.id}`}
          className="mt-4 aspect-square w-full rounded-3xl shadow-lg"
          style={{ background: artworkFor(act.hue) }}
          aria-hidden="true"
        />

        <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
          {act.artist}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {act.venue} · {act.day} {act.time}
        </p>
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {t.app.body}
        </p>

        <span className="mt-auto block rounded-full bg-[var(--color-primary)] px-5 py-3 text-center text-sm font-semibold text-white">
          ₩{act.price}
        </span>
      </div>
    </Screen>
  );
}

export default ActScreen;
