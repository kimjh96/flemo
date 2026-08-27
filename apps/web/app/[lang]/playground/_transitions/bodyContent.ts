import { createRawPartTransition } from "@flemo/react";

import { CLOCKS, bodyPartFor, type Clock } from "./clocks";

import "./bodyContent.types";

type AuthoredPart = ReturnType<typeof createRawPartTransition>;

// THE SCREEN'S OWN CONTENT, on the screen's own clock.
//
// This is the part the previous playground got most wrong, and it is worth
// recording what it got wrong so it is not walked back into.
//
// It shipped TWO of these, `detail-content` (0.4s in after an 0.08s delay,
// 0.22s out) and `step-content` (0.32s in, 0.3s out), and chose between them
// per screen on whether a shared element was present. Both numbers were tuned
// against a ~0.35s screen transition. Under `cupertino` — the default preset,
// at 0.7s — the copy finished arriving less than 70% of the way through the
// flight and left in under a third of it, so the screen stood finished while it
// was still travelling. Under `none`, at 0s, a 0.4s clock was the entire length
// of a navigation that was supposed to be a cut.
//
// The fix is not better constants. It is the same one as the bar: generate one
// per screen transition from the clock table, and let the screen ask for the
// one belonging to the transition carrying it.
//
// WHAT IS STILL AUTHORED, because it is not timing:
//
// The DELAY is gone. It existed so the copy would arrive after a shared element
// had begun moving, which is a real concern — but a delay expressed in seconds
// is another constant that only holds at one duration. A morph already lands
// with its screen (it inherits `screenDuration`), so copy that also lands with
// its screen arrives together with the element by construction, and needs no
// offset to stay with it.
//
// The ASYMMETRY is gone too. `detail-content` left in half the time it arrived
// in, on the reasoning that the eye is following an element out. Measured on
// the chain's fade step, the old file's own note records the result: the push
// ran ~480ms of visible motion and the pop ran ~200ms, so the same navigation
// in reverse read as a different, blunter transition. A navigation and its
// reverse are the same event; they get the same clock.
const REST = { opacity: 1, y: 0 };

// A few pixels of rise. Small on purpose: this is the content settling into a
// screen that is itself arriving, not a second entrance.
const RISE = 10;

const build = (name: string, clock: Clock): AuthoredPart => {
  const { duration, ease } = clock;
  const held = { value: REST, options: { duration: 0 } };
  const move = (value: Record<string, number>) => ({ value, options: { duration, ease } });

  return createRawPartTransition({
    name: bodyPartFor(name),
    initial: { opacity: 0, y: RISE },
    idle: held,
    pushOnEnter: move(REST),
    // The screen going behind is covered by the one arriving over it, so its
    // copy has nothing to do: holding is honest and costs the flight nothing.
    // (This is the one place the asymmetry above is correct, and it is a
    // structural asymmetry rather than a timing one.)
    pushOnExit: held,
    replaceOnEnter: move(REST),
    replaceOnExit: held,
    // The dismissing screen's copy, on the clock it arrived with.
    popOnEnter: move({ opacity: 0, y: RISE }),
    popOnExit: held,
    completedOnEnter: held,
    completedOnExit: held
  });
};

export const BODY_PARTS: AuthoredPart[] = Object.entries(CLOCKS).map(([name, clock]) =>
  build(name, clock)
);

export default BODY_PARTS;
