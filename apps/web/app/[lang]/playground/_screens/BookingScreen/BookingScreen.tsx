"use client";

import { Morph, Part, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import AppBar from "../../_components/AppBar";
import BackButton from "../../_components/BackButton";
import StageScreen from "../../_components/StageScreen";

import { barPartFor, bodyPartFor } from "../../_transitions/clocks";

import { BOOKING, stepAt } from "../../_data/booking";
import { ACTS, posterFor } from "../../_data/tonight";

// ONE component for every step of the booking flow.
//
// Nothing here knows which transition is flying — it looks its own step up in
// the table and asks for the parts belonging to THAT step's transition. Which
// is the same rule as the bench, arrived at from the other direction: there the
// flight is chosen by a switch, here it is chosen by where you are in the flow,
// and in both cases the parts are selected with it rather than fixed.
//
// The act is fixed for the flow, because the flow is about the STACK: five
// pushes, five different transitions, and whether five pops unwind them in the
// right order.
const ACT = ACTS[0]!;

function BookingScreen() {
  const { push, pop } = useNavigate();
  const params = useParams<"/booking/:step">();
  const t = getDict(useShellLang()).playground.booking;
  const found = stepAt(params?.step);

  if (!found) return null;

  const { step, index } = found;
  const next = BOOKING[index + 1];
  const fullBleed = Boolean(step.fullBleed);
  const copy = t.body[step.id as keyof typeof t.body];

  // The step's OWN transition names its parts. A step reached by `material`
  // (0.35s) and a step reached by `cupertino` (0.7s) cannot share one clock,
  // which is the whole finding this rebuild is built on.
  const barPart = barPartFor(step.transitionName);
  const bodyPart = bodyPartFor(step.transitionName);

  return (
    <StageScreen
      backgroundColor={fullBleed ? "transparent" : "var(--color-bg)"}
      // The same bar under one id across every step: its box holds still while
      // the label hands over with the flight. The full-bleed step declares
      // none, so the bar leaves with its own motion.
      sharedTopBarId={fullBleed ? undefined : "booking"}
      sharedTopBar={
        fullBleed ? undefined : (
          <AppBar
            part={barPart}
            title={t.steps[step.id as keyof typeof t.steps]}
            lead={index === 0 ? undefined : <BackButton onClick={() => pop()} />}
          />
        )
      }
    >
      <div className="flex h-full flex-col">
        {fullBleed ? (
          <Part name={bodyPart} className="absolute inset-x-0 top-0 z-10 px-3 pt-3">
            <BackButton onClick={() => pop()} />
          </Part>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
          {/* The step that ARRIVED by morph carries the big side of the pair
              that brought it here. */}
          {step.morphName ? (
            <Morph
              layoutId={`booking-${step.id}`}
              name={step.morphName}
              className="block overflow-hidden rounded-2xl"
            >
              <span
                className="block aspect-[4/3] w-full"
                style={{ background: posterFor(ACT.hue) }}
                aria-hidden="true"
              />
            </Morph>
          ) : null}

          <Part name={bodyPart} className={step.morphName ? "mt-4" : ""}>
            <span className="block text-lg font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
              {ACT.artist}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
              {ACT.venue} · {ACT.day} {ACT.time}
            </span>
          </Part>

          <Part name={bodyPart} className="mt-3">
            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{copy}</p>
          </Part>

          {next ? (
            <Part name={bodyPart} className="mt-5">
              <button
                type="button"
                data-booking-next={next.id}
                onClick={() =>
                  push("/booking/:step", { step: next.id }, { transitionName: next.transitionName })
                }
                className="w-full cursor-pointer text-left"
              >
                {next.morphName ? (
                  // The SMALL side of the pair that takes this screen to the
                  // next one. A step therefore carries at most two morph
                  // elements: the one it arrived with and the one it leaves by.
                  <Morph
                    layoutId={`booking-${next.id}`}
                    name={next.morphName}
                    as="span"
                    className="block overflow-hidden rounded-xl"
                  >
                    <span
                      className="block aspect-[4/3] w-full"
                      style={{ background: posterFor(ACT.hue) }}
                      aria-hidden="true"
                    />
                  </Morph>
                ) : null}
                <span
                  className={`${
                    next.morphName ? "mt-2 " : ""
                  }flex items-center justify-between rounded-full bg-[var(--color-primary)] px-5 py-3`}
                >
                  <span className="text-sm font-semibold text-white">
                    {t.next[next.id as keyof typeof t.next]}
                  </span>
                  <span className="font-mono text-[11px] text-white/70">
                    {next.transitionName}
                    {next.morphName ? ` + ${next.morphName}` : ""}
                  </span>
                </span>
              </button>
            </Part>
          ) : (
            <Part name={bodyPart} className="mt-5">
              <span className="block rounded-full bg-[var(--color-layer)] px-5 py-3 text-center text-sm font-semibold text-[var(--color-text-secondary)]">
                {t.end}
              </span>
            </Part>
          )}
        </div>
      </div>
    </StageScreen>
  );
}

export default BookingScreen;
