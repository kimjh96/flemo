"use client";

import { Part, useNavigate, useParams, useStep } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import AppBar from "../../_components/AppBar";
import Poster from "../../_components/Poster";
import Shared from "../../_components/Shared";
import StageScreen from "../../_components/StageScreen";

import { useMotionChoice } from "../../_providers/MotionChoiceContext";

import { ACTS } from "../../_data/tonight";

// The source side: tonight's listings.
//
// Each row is a nest of shared elements — the card, the poster inside it, and
// the artist's name inside that — all three paired across the flight. So this
// is the container case, the element case and the nested case in one screen,
// without a single screen here knowing which transition is carrying them.
//
// Its bar is a SHARED bar, handed up under the same id as the detail screen's.
// That is what lets the box hold still while the title hands over: Router-level
// chrome rendered beside the <Slot> would also hold still, but it would have to
// swap its own text at the end of the flight, since it belongs to no screen and
// so has no side of the hand-over to be on.
//
// What it does carry is a filter opened with `useStep`: a sub-state of this
// screen rather than a screen of its own, so it stacks nothing and the depth
// under the frame does not move.
function ActsScreen() {
  const { push } = useNavigate();
  const { transition, morph, barPart, bodyPart } = useMotionChoice();
  const t = getDict(useShellLang()).playground;
  // The step's state is the SCREEN's params: `useStep` pushes and pops it,
  // `useParams` reads it back.
  const { pushStep, popStep } = useStep<"/browse/acts">();
  const params = useParams<"/browse/acts">();
  const filterOpen = Boolean(params?.filter);

  return (
    <StageScreen
      backgroundColor="var(--color-bg)"
      sharedTopBarId="app"
      sharedTopBar={
        <AppBar
          part={barPart}
          title={t.app.tonight}
          trail={
            <button
              type="button"
              onClick={() => (filterOpen ? popStep() : pushStep({ filter: true }))}
              aria-expanded={filterOpen}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-layer)]"
            >
              {t.app.filter}
            </button>
          }
        />
      }
    >
      <div className="relative h-full">
        <div className="h-full overflow-y-auto px-4 pt-3 pb-8">
          <Part name={bodyPart}>
            <p className="text-[13px] leading-relaxed text-[var(--color-text-disabled)]">
              {morph.name ? t.acts.hintShared : t.acts.hintPlain}
            </p>
          </Part>

          <ul className="mt-3 flex flex-col gap-2">
            {ACTS.map((act) => (
              <li key={act.id}>
                <button
                  type="button"
                  onClick={() =>
                    push("/browse/act/:id", { id: act.id }, { transitionName: transition.id })
                  }
                  className="w-full cursor-pointer text-left"
                >
                  <Shared
                    layoutId={`card-${act.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-[var(--color-layer)] p-2.5"
                  >
                    <Poster act={act} place="thumb" />
                    <span className="min-w-0 flex-1">
                      <Shared
                        layoutId={`title-${act.id}`}
                        name="text"
                        as="span"
                        className="block truncate text-sm font-bold text-[var(--color-text-primary)]"
                      >
                        {act.artist}
                      </Shared>
                      <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">
                        {act.venue} · {act.day} {act.time}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-[var(--color-text-secondary)] tabular-nums">
                      ₩{act.price}
                    </span>
                  </Shared>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {filterOpen ? (
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[var(--color-border)] bg-[var(--color-layer)] p-5 shadow-[0_-18px_40px_-24px_rgba(15,23,42,0.4)]">
            <h3 className="text-base font-extrabold text-[var(--color-text-primary)]">
              {t.app.filterTitle}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {t.app.filterBody}
            </p>
            <button
              type="button"
              onClick={() => popStep()}
              className="mt-4 cursor-pointer rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              {t.app.close}
            </button>
          </div>
        ) : null}
      </div>
    </StageScreen>
  );
}

export default ActsScreen;
