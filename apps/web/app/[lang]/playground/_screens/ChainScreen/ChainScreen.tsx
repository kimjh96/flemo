"use client";

import { Morph, Part, useNavigate, useParams } from "@flemo/react";

import AppBar from "../../_components/AppBar";
import BackButton from "../../_components/BackButton";
import StageScreen from "../../_components/StageScreen";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import { CHAIN, stepAt, surfaceFor } from "../../_data/chain";

// One component for every step of the chain. A screen carries at most two
// morph elements: the BIG side of the pair that brought it here (when it
// arrived by morph) and the SMALL side of the pair that takes it to the next
// step (when the next step arrives by morph). Nothing here knows which
// transition is flying, which is the whole claim being tested.
function ChainScreen() {
  const { push, pop } = useNavigate();
  const params = useParams<"/playground/chain/:step">();
  const t = getDict(useShellLang()).playground;
  const found = stepAt(params?.step);

  if (!found) return null;

  const { step, index } = found;
  const next = CHAIN[index + 1];
  const fullBleed = Boolean(step.fullBleed);
  const pad = fullBleed ? "px-5" : "";
  // A step that arrives with a shared element hands its copy to
  // `detail-content`, which leaves early because the eye is following the
  // element out. A step with no element has nothing to follow, so its copy
  // leaves on the clock it arrived with.
  const partName = step.morphName ? "detail-content" : "step-content";

  // The heading is its own piece because a morph step PAIRS it: the same words
  // at both ends, small on the card and large on the screen it opens into, so
  // the text grows into place instead of one string being cross-faded into a
  // different one.
  // The bottom of the stack is not "screen Start": it is where the chain
  // begins, and the lettered steps above it are the ones being counted.
  const heading = index === 0 ? t.chainScreen.rootTitle : `${t.chainScreen.next} ${step.label}`;

  // A morph carries what is PAIRED. Everything else on the arriving screen (the
  // note, the button to the next step) has no counterpart to travel from,
  // so without a choreography of its own it simply appears the moment its
  // screen does, a beat away from the element that is still moving. `<Part>` is
  // what the library gives that content.
  const trail = (
    <>
      <Part
        name={partName}
        className={`${pad} mt-2 text-xs font-semibold text-[var(--color-text-disabled)]`}
      >
        {t.chainSteps[step.id as keyof typeof t.chainSteps]}
      </Part>
      {next ? (
        <Part name={partName}>
          <button
            type="button"
            onClick={() =>
              push(
                "/playground/chain/:step",
                { step: next.id },
                { transitionName: next.transitionName }
              )
            }
            data-chain-next={next.id}
            className={`${pad} mt-4 block w-full cursor-pointer text-left`}
          >
            {next.morphName ? (
              // THREE pairs. The card is the container; the artwork and the
              // heading inside it are paired on their own, so they grow with it
              // instead of being covered by the ghost's cross-fade while the box
              // around them changes size, which is what "it just fades" looks
              // like.
              <Morph
                layoutId={`chain-${next.id}`}
                name={next.morphName}
                className="block overflow-hidden rounded-2xl bg-[var(--color-layer)] p-2"
              >
                <Morph
                  layoutId={`chain-${next.id}-art`}
                  as="span"
                  className="block aspect-square w-full rounded-xl"
                  style={{ background: surfaceFor(next.hue) }}
                  aria-hidden="true"
                />
                <Morph
                  layoutId={`chain-${next.id}-title`}
                  name="text"
                  as="span"
                  className="mt-2 block truncate text-sm font-semibold text-[var(--color-text-primary)]"
                >
                  {t.chainScreen.next} {next.label}
                </Morph>
              </Morph>
            ) : (
              // The same card, minus the pairing. A step that arrives without a
              // morph should look like every other step until it is tapped:
              // what differs is the flight, not the furniture.
              <span className="block overflow-hidden rounded-2xl bg-[var(--color-layer)] p-2">
                <span
                  className="block aspect-square w-full rounded-xl"
                  style={{ background: surfaceFor(next.hue) }}
                  aria-hidden="true"
                />
                <span className="mt-2 block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {t.chainScreen.next} {next.label} · {next.transitionName}
                </span>
              </span>
            )}
          </button>
        </Part>
      ) : (
        <Part name={partName} className={`${pad} mt-4 text-sm text-[var(--color-text-secondary)]`}>
          {t.chainScreen.end}
        </Part>
      )}
    </>
  );

  return (
    <StageScreen
      backgroundColor={fullBleed ? "transparent" : "var(--color-bg)"}
      // The same app bar as the browse bench, under one id across every step:
      // its box holds still while the contents hand over with the flight. The
      // full-bleed step declares none, so the bar leaves with its own motion.
      sharedTopBarId={fullBleed ? undefined : "app"}
      sharedTopBar={
        fullBleed ? undefined : (
          <AppBar
            title={`${t.chainScreen.step} ${step.label}`}
            lead={index === 0 ? undefined : <BackButton onClick={() => pop()} />}
          />
        )
      }
    >
      <div className="relative flex h-full flex-col">
        <div
          className={
            fullBleed
              ? "min-h-0 flex-1 overflow-y-auto"
              : "min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-8"
          }
        >
          {step.morphName ? (
            <Morph
              layoutId={`chain-${step.id}`}
              name={step.morphName}
              className={
                fullBleed
                  ? "block min-h-full bg-[var(--color-bg)] pb-8"
                  : "block overflow-hidden rounded-3xl bg-[var(--color-layer)] p-3"
              }
            >
              <Morph
                layoutId={`chain-${step.id}-art`}
                as="span"
                className={
                  fullBleed ? "block aspect-[4/3] w-full" : "block aspect-[4/3] w-full rounded-2xl"
                }
                style={{ background: surfaceFor(step.hue) }}
                aria-hidden="true"
              />
              <Morph
                layoutId={`chain-${step.id}-title`}
                name="text"
                as="span"
                className={`${pad} mt-3 block text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]`}
              >
                {heading}
              </Morph>
              {trail}
            </Morph>
          ) : (
            <>
              <h2
                className={`${pad} mt-3 text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]`}
              >
                {heading}
              </h2>
              {trail}
            </>
          )}
        </div>
      </div>
    </StageScreen>
  );
}

export default ChainScreen;
