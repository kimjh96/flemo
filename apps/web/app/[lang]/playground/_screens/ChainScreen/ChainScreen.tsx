"use client";

import { Morph, Part, Screen, useNavigate, useParams } from "@flemo/react";

import { CHAIN, stepAt, surfaceFor } from "../../_data/chain";

// One component for every step of the chain. A screen carries at most two
// morph elements: the BIG side of the pair that brought it here (when it
// arrived by morph) and the SMALL side of the pair that takes it to the next
// step (when the next step arrives by morph). Nothing here knows which
// transition is flying — that is the whole claim being tested.
function ChainScreen() {
  const { push, pop } = useNavigate();
  const params = useParams<"/playground/chain/:step">();
  const found = stepAt(params?.step);

  if (!found) return null;

  const { step, index } = found;
  const next = CHAIN[index + 1];
  const fullBleed = Boolean(step.fullBleed);
  const pad = fullBleed ? "px-5" : "";

  // The heading is its own piece because a morph step PAIRS it: the same words
  // at both ends, small on the card and large on the screen it opens into, so
  // the text grows into place instead of one string being cross-faded into a
  // different one.
  const heading = `Screen ${step.label}`;

  // A morph carries what is PAIRED. Everything else on the arriving screen —
  // the note, the button to the next step — has no counterpart to travel from,
  // so without a choreography of its own it simply appears the moment its
  // screen does, a beat away from the element that is still moving. `<Part>` is
  // what the library gives that content.
  const trail = (
    <>
      <Part
        name="detail-content"
        className={`${pad} mt-2 text-xs font-semibold text-[var(--color-text-disabled)]`}
      >
        {step.note}
      </Part>
      {next ? (
        <Part name="detail-content">
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
              // around them changes size — which is what "it just fades" looks
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
                  Screen {next.label}
                </Morph>
              </Morph>
            ) : (
              <span className="block rounded-2xl bg-[var(--color-layer)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">
                Screen {next.label} · {next.transitionName}
              </span>
            )}
          </button>
        </Part>
      ) : (
        <Part
          name="detail-content"
          className={`${pad} mt-4 text-sm text-[var(--color-text-secondary)]`}
        >
          End of the chain. Pop back out and every transition runs in reverse, in order.
        </Part>
      )}
    </>
  );

  return (
    <Screen backgroundColor={fullBleed ? "transparent" : undefined}>
      <div className="relative flex h-full flex-col">
        <header
          className={
            fullBleed
              ? "absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-4 pt-4"
              : "relative z-10 flex items-center gap-2 px-4 pt-4"
          }
        >
          <button
            type="button"
            onClick={() => pop()}
            aria-label="Back"
            hidden={index === 0}
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
            step {step.label}
          </span>
        </header>

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
    </Screen>
  );
}

export default ChainScreen;
