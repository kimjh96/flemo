"use client";

import { Morph, Screen, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import CardShell from "../../_components/CardShell";

import { actById, artworkFor } from "../../_data/acts";
import { useBench } from "../../_providers/BenchContext";

// The detail. The other half of the list row's <Morph>: the same `layoutId`, so
// the little square in the list and this one are one thing to flemo.
//
// SAME SHAPE at both ends: a square there, a square here. The docs name the
// alternative and the symptom it produces:
//
//   attachMorph.ts
//     "SHAPE, not just size. A square thumbnail becoming a 4:3 hero has to pass
//      through the ratios between, or it snaps to its destination's proportions
//      on the first frame and only the box around it grows, which is the 'it
//      does not scale proportionally' everyone sees and nobody can name."
//
// It declares NO shared bar, so the list's tab bar rides out with the list and
// returns on the pop. Nothing here is transition-aware: no full-bleed flag, no
// transparent background, no part transitions. Whatever the bench has selected
// is carrying this screen, and this screen does not know which.
//
// THE COPY HERE IS THE APP'S, not the library's. An earlier version explained
// the morph inside the very screen it was demonstrating, which reads as
// documentation wearing app clothes. What flemo is doing belongs beside the
// stage, where a reader can look at the sentence and the motion at once.
function ActScreen() {
  const navigate = useNavigate();
  const params = useParams<"/tonight/act/:id">();
  const act = actById(params?.id);
  const t = getDict(useShellLang()).playground;
  const { morph } = useBench();

  if (!act) return null;

  // Reaching past the top in one transition. `until` collapses the list as well
  // as this screen, so the stack lands on the tickets tab alone instead of
  // leaving a stale detail underneath it:
  //
  //   createNavigationController.ts
  //     "replace: replaces it; the target and everything above become the new
  //      screen"
  const getTickets = () => navigate.replace("/tonight/tickets", {}, { until: "/tonight" });

  const facts: [string, string][] = [
    [t.app.doors, `${act.day} ${act.time}`],
    [t.app.venue, act.venue],
    [t.app.age, t.app.ageValue]
  ];

  return (
    <Screen statusBarHeight="0px" systemNavigationBarHeight="0px" backgroundColor="var(--color-bg)">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 pt-4">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-4">
          {/* THE PAGE IS THE CARD under the container transform, which is what
              makes the cell become this screen rather than release a square
              into it. It pairs only when a grid cell opened this, because a
              morph with no partner on the other side is a promise flemo cannot
              keep, and only the grid draws a card.

              The ARRANGEMENT matches the cell on purpose: artwork across the
              content width, then the name, then the line of meta, all reading
              down and all aligned the same way. The deleted playground recorded
              what happens otherwise, with a row list against this page: "every
              intermediate frame is a stretched hybrid". */}
          <CardShell
            layoutId={params?.from === "cell" ? `card-${act.id}` : null}
            className="block min-h-full bg-[var(--color-bg)]"
          >
            <Morph
              // The BIG side. It names the same morph AND the same id as the
              // surface that opened it, because a pair whose two halves disagree
              // is not a pair. The list scopes its ids to rows and the posters
              // grid scopes its to cells, so which one to answer to arrives on
              // the route rather than being guessed.
              name={morph}
              layoutId={`${params?.from ?? "row"}-${act.id}`}
              className="block aspect-square w-full rounded-2xl shadow-lg"
              style={{ background: artworkFor(act.hue) }}
              aria-hidden="true"
            />

            <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
              {act.artist}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {act.venue} · {act.day} {act.time}
            </p>

            <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {t.app.body}
            </p>

            <dl className="mt-5 flex flex-col gap-2 rounded-2xl bg-[var(--color-layer)] p-4 text-[13px]">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--color-text-disabled)]">{label}</dt>
                  <dd className="m-0 font-semibold text-[var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          </CardShell>
        </div>

        {/* The footer is a sibling of the scroller, not the last thing inside
            it, so the buy control stays reachable however far the page is
            scrolled. The border and the translucent blur are the same treatment
            the site's own MiniPlayer uses for a bar that sits over content;
            without them, the row clipped at the scroller's edge reads as being
            UNDER the button rather than scrolling behind it. */}
        <div className="shrink-0 border-t border-[var(--color-border-light)] bg-[var(--color-bg)]/85 px-5 pt-4 pb-6 backdrop-blur-xl">
          <button
            type="button"
            onClick={getTickets}
            className="w-full cursor-pointer rounded-full bg-[var(--color-primary)] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            {t.app.getTickets} · ₩{act.price}
          </button>
        </div>
      </div>
    </Screen>
  );
}

export default ActScreen;
