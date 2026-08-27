import { createRawPartTransition } from "@flemo/react";

import { CLOCKS, bodyPartFor, type Clock } from "./clocks";

import "./bodyContent.types";

type AuthoredPart = ReturnType<typeof createRawPartTransition>;

// THE SCREEN'S OWN CONTENT, on the screen's own clock.
//
// This is the part the first playground got most wrong, and the mistake is
// worth recording so it is not walked back into. It shipped two of these —
// `detail-content` (0.4s in after an 0.08s delay, 0.22s out) and `step-content`
// (0.32s in, 0.3s out) — and chose between them per screen on whether a shared
// element was present. Every number was tuned against a ~0.35s transition.
// Under `cupertino`, the default preset at 0.7s, the copy finished arriving
// less than 70% of the way through the flight and left in under a third of it.
// Under `none`, at 0s, a 0.4s clock was the entire length of a navigation that
// was supposed to be a cut.
//
// The fix is not better constants. It is one generated per screen transition
// from the clock table, per direction, with the screen asking for the one that
// belongs to the flight carrying it.
//
// WHAT IS STILL AUTHORED, because it is not timing:
//
// The DELAY is gone. It existed so the copy would arrive after a shared element
// had begun moving, which is a real concern — but a delay in seconds is another
// constant that only holds at one duration. A morph already lands with its
// screen (it inherits `screenDuration`), so copy that also lands with its
// screen arrives together with the element by construction.
//
// The ASYMMETRY is gone. `detail-content` left in half the time it arrived in,
// on the reasoning that the eye is following an element out. Its own note
// records the result: the push ran ~480ms of visible motion and the pop ran
// ~200ms, so the same navigation in reverse read as a different, blunter
// transition. A navigation and its reverse are the same event. Where flemo's
// own preset IS asymmetric — material, 0.35s out and 0.25s back — that
// asymmetry is inherited from the clock table rather than invented here.
const REST = { opacity: 1, y: 0 };

// A few pixels of rise. Small on purpose: this is content settling into a
// screen that is itself arriving, not a second entrance.
const RISE = 10;

const build = (name: string, clock: Clock): AuthoredPart => {
  const held = { value: REST, options: { duration: 0 } };
  const push = (value: Record<string, number>) => ({ value, options: { ...clock.push } });
  const pop = (value: Record<string, number>) => ({ value, options: { ...clock.pop } });

  return createRawPartTransition({
    name: bodyPartFor(name),
    initial: { opacity: 0, y: RISE },
    idle: held,
    pushOnEnter: push(REST),
    // The screen going behind is covered by the one arriving over it, so its
    // copy has nothing to do: holding is honest and costs the flight nothing.
    // This is a STRUCTURAL asymmetry — about what is visible — rather than a
    // timing one, which is why it survives the rule above.
    pushOnExit: held,
    replaceOnEnter: push(REST),
    replaceOnExit: held,
    // The dismissing screen's copy, on the pop clock its screen is running.
    popOnEnter: pop({ opacity: 0, y: RISE }),
    popOnExit: held,
    completedOnEnter: held,
    completedOnExit: held
  });
};

export const BODY_PARTS: AuthoredPart[] = Object.entries(CLOCKS).map(([name, clock]) =>
  build(name, clock)
);

export default BODY_PARTS;
