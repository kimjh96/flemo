import { type PropsWithChildren } from "react";

import { createPortal } from "react-dom";

import {
  ACTIVE_ATTR,
  ANIM_HOLD_ATTR,
  LAYER_SLOT_ATTR,
  STATUS_ATTR,
  TRANSITION_ATTR
} from "@flemo/core";

import { useLayerHost, useLayerOwner } from "@screen/LayerContext";

export type LayerProps = PropsWithChildren;

/**
 * Render an overlay beside the screen instead of inside it, so it can cover
 * the shared bars.
 *
 * A screen that is moving carries a transform, and a transform is both a
 * containing block for `position: fixed` descendants and a stacking context
 * around all of them. The shared bars live outside the screen, as siblings. So
 * a sheet written inside the screen is ONE atom with the screen's content as
 * far as the bars are concerned, and a stacking context cannot be interleaved
 * with an element outside it: "content under the bar, sheet over the bar" is
 * not expressible from in there, at any z-index.
 *
 * ```tsx
 * <Screen sharedBottomBar={<TabBar />}>
 *   <Content />
 *   <Layer>
 *     <BottomSheet open={open} />
 *   </Layer>
 * </Screen>
 * ```
 *
 * What leaves the screen is the PAINT ORDER, and only that. The slot keeps its
 * owner's stack position, its status and transition (so it moves with the
 * screen and leaves with it), its animation hold, and its paint-hidden state.
 * It is rendered from inside the screen's own React subtree, so React freezes
 * it with the screen and unmounts it with the screen without being asked.
 *
 * At rest none of this is needed: a screen at rest carries no transform, so a
 * consumer's `position: fixed` overlay already resolves against the viewport
 * and already outranks the bars with a z-index of its own. `<Layer>` is for
 * the overlay that has to survive the screen MOVING under it, and for the one
 * that has to clear chrome an ancestor screen declared.
 *
 * Children keep whatever positioning they had. On the server, and for the
 * first render before the host mounts, this renders nothing.
 */
function Layer({ children }: LayerProps) {
  const host = useLayerHost();
  const owner = useLayerOwner();

  if (!host || !owner) return null;

  return createPortal(
    <div
      {...{ [LAYER_SLOT_ATTR]: "" }}
      {...(owner.rendersHost
        ? // The host is this screen's own and already rides this flight. Riding
          // here too would compose the two transforms and send the overlay
          // twice as far as the screen it belongs to.
          {}
        : {
            [TRANSITION_ATTR]: owner.transitionName,
            [STATUS_ATTR]: owner.status,
            [ACTIVE_ATTR]: owner.isActive ? "true" : "false",
            [ANIM_HOLD_ATTR]: owner.animHold
          })}
      style={{
        // A box, deliberately. The slot animates, and an animating box is a
        // containing block for `position: fixed` children — which would be a
        // problem if the box were not already the viewport. It is: the host
        // belongs to the OUTERMOST screen, and the outermost screen is the
        // root Router's, which is `position: fixed` at full size. So a
        // consumer's `bottom: 0` resolves to the same edge whether the slot is
        // mid-flight or at rest, and nothing jumps at the start or end of a
        // transition.
        position: "absolute",
        inset: 0,
        // Never a hit target itself. A slot spans the whole region, so without
        // this an overlay that only draws a sheet at the bottom would silently
        // eat every tap above it. The children get their own pointers back
        // through the box-less wrapper below.
        pointerEvents: "none",
        // Stack by the OWNER, so two screens' overlays order the way their
        // screens do. Portal mount order — which is what a single shared host
        // leaves you with — has nothing to do with which screen is on top.
        zIndex: owner.zIndex,
        // The half a portal cannot inherit: `visibility: hidden` on the screen
        // container is CSS and reaches only that container's own descendants.
        // React's freeze does cross the portal, but it lands later, so without
        // this the overlay is the last thing painting on a covered screen.
        visibility: owner.paintHidden ? "hidden" : undefined
      }}
    >
      {/*
        `display: contents` generates no box at all, so this cannot become a
        hit target the way a real element would — it only restores the pointer
        events the slot turned off, by inheritance, for whatever the consumer
        put inside.
      */}
      <div style={{ display: "contents", pointerEvents: "auto" }}>{children}</div>
    </div>,
    host
  );
}

export default Layer;
