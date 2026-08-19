import { AnimatePresence } from "motion/react";

import { Screen, type ScreenProps } from "@flemo/react";

/**
 * A Screen whose children are wrapped in motion's `AnimatePresence`, so
 * elements with matching `layoutId` morph between screens instead of being
 * cut at the boundary.
 *
 * It DELEGATES to `Screen` rather than composing ScreenFreeze + ScreenMotion
 * itself. It used to hand-roll the freeze predicate, which quietly froze it in
 * time: the predicate moved into core (`computeScreenFreezeMode`), the direct
 * prev screen's freeze became deferred (600ms, on a paired device A/B of ~0.2
 * dropped frames per flight), and `flemo:freeze=shallow` became URL-armable —
 * and a LayoutScreen consumer got none of it, paying the freeze commit on the
 * exact frames the eye watches settle. Delegation is what keeps this package a
 * thin motion adapter instead of a second, drifting screen implementation.
 *
 * The transparent background is the one deliberate difference: a morphing
 * element travels between two screens, so the covering screen must not paint
 * over the one beneath it.
 */
function LayoutScreen({ children, ...props }: ScreenProps) {
  return (
    <Screen
      {...props}
      style={{
        backgroundColor: "transparent",
        ...props.style
      }}
    >
      <AnimatePresence>{children}</AnimatePresence>
    </Screen>
  );
}

export default LayoutScreen;
