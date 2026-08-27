"use client";

import { Part, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import AppBar from "../../_components/AppBar";
import BackButton from "../../_components/BackButton";
import Poster from "../../_components/Poster";
import Shared from "../../_components/Shared";
import StageScreen from "../../_components/StageScreen";

import { useMotionChoice } from "../../_providers/MotionChoiceContext";
import { useFlightParts } from "../../_hooks/useFlightParts";

import { actById } from "../../_data/tonight";

// The destination side. The same three `layoutId`s at the sizes they belong at
// here: the card fills the screen, the poster becomes the hero, the artist's
// name becomes the heading. Nothing on this screen is morph-aware beyond those
// three props — no wrapper screen, no transition requirement.
function ActScreen() {
  const navigate = useNavigate();
  // The SAME hook, aimed one Router up. `router: "parent"` is how a screen in a
  // nested stack pushes onto the app's stack instead of its own — which is the
  // real distinction a ticket app makes: an act opens inside the tab and keeps
  // the tab bar, a seat map takes over the whole app and does not.
  const parent = useNavigate({ router: "parent" });
  const params = useParams<"/browse/act/:id">();
  const act = actById(params?.id);
  // The bench sets one transition for the whole app, but the parts are asked
  // of flemo all the same: `useScreen().transitionName` is the FLIGHT's, so a
  // screen can never be authored against a clock the flight is not running.
  const { transition } = useMotionChoice();
  const { barPart, bodyPart } = useFlightParts();
  const t = getDict(useShellLang()).playground;
  const fullBleed = transition.fullBleed ?? false;

  if (!act) return null;

  return (
    <StageScreen
      backgroundColor={fullBleed ? "transparent" : "var(--color-bg)"}
      // The full-bleed case hands the whole frame to the element, so it
      // declares no bar and the bar leaves with its own motion.
      sharedTopBarId={fullBleed ? undefined : "app"}
      sharedTopBar={
        fullBleed ? undefined : (
          <AppBar
            part={barPart}
            title={act.artist}
            lead={<BackButton onClick={() => navigate.pop()} />}
          />
        )
      }
    >
      <div className="relative flex h-full flex-col">
        {/* The full-bleed case has no bar to hold a back control, so the
            control rides the body's own part instead. Same clock either way. */}
        <Part
          name={bodyPart}
          hidden={!fullBleed}
          className={fullBleed ? "absolute inset-x-0 top-0 z-10 px-3 pt-3" : "hidden"}
        >
          <BackButton onClick={() => navigate.pop()} />
        </Part>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Shared
            layoutId={`card-${act.id}`}
            pairFor={["zoom"]}
            className="block min-h-full bg-[var(--color-bg)]"
          >
            <Poster act={act} place="hero" />

            <div className="px-4 pb-8">
              <Shared
                layoutId={`title-${act.id}`}
                name="text"
                className="mt-4 block text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]"
              >
                {act.artist}
              </Shared>

              <Part name={bodyPart} className="mt-1">
                <span className="block text-sm text-[var(--color-text-secondary)]">
                  {act.venue} · {act.day} {act.time}
                </span>
              </Part>

              <Part name={bodyPart} className="mt-4">
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                  {t.act.body}
                </p>
              </Part>

              <Part name={bodyPart} className="mt-5">
                <span className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      parent.push(
                        "/tonight/seatmap/:id",
                        { id: act.id },
                        { transitionName: "fade" }
                      )
                    }
                    className="w-full cursor-pointer rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
                  >
                    {t.act.seatmap} · ₩{act.price}
                  </button>
                  <span className="text-center text-[11px] leading-relaxed text-[var(--color-text-disabled)]">
                    {t.act.seatmapNote}
                  </span>
                </span>
              </Part>
            </div>
          </Shared>
        </div>
      </div>
    </StageScreen>
  );
}

export default ActScreen;
