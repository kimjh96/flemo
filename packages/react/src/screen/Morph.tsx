import {
  createElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type JSX,
  type PropsWithChildren
} from "react";

import { useStore } from "zustand";

import { attachMorph, type MorphTransitionName } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useStores from "@stores/useStores";

import RouterIdContext from "../RouterIdContext";

export interface MorphProps extends PropsWithChildren<ComponentPropsWithRef<"div">> {
  // The pairing key. The element with the same `layoutId` on the other screen
  // of a flight is the SAME element as far as the eye is concerned, so this one
  // travels from there instead of appearing where it belongs.
  layoutId: string | number;
  // A registered createMorphTransition `name`. Defaults to the built-in
  // `shared` preset, which authors no timing and therefore lands with whatever
  // screen transition is flying.
  name?: MorphTransitionName;
  // The tag to render (default `div`). A morph is a real box in the consumer's
  // layout, so it has to be able to be a `span` inside a button. Props stay
  // typed as a div's: the intersection every candidate tag shares is close
  // enough to it that narrowing per tag would cost more in generics than it
  // returns. Wrap structural tags (`li`, `td`) rather than becoming them.
  as?: keyof JSX.IntrinsicElements;
}

// A shared element: one thing that exists on two screens.
//
// The component is deliberately almost empty. Everything a morph does —
// pairing the two sides, measuring the travel, staging it in the flight layer,
// emitting the keyframes, riding the same hold the screens obey, putting the
// element back on landing — lives in @flemo/core's morph runtime, which reads
// what it needs off the DOM protocol. This is the whole React share of it:
// render a box, and register it before paint. A Solid or Svelte binding is the
// same twenty lines in its own dialect.
//
// It is NOT tied to a particular screen transition. During the flight the
// element is staged ABOVE both screens, so whatever the screens are doing —
// fading, sliding, cutting — cannot clip it, cover it or carry it along.
//
// The SLOT is why there are two elements. The runtime moves the inner one out
// for the flight, and React must never be asked to remove a node that is not
// where it left it: the slot stays put and takes that removal. It is
// `display: contents` at rest, so the consumer's layout sees only the box they
// wrote; the runtime gives it the element's measured size for the flight, so
// nothing reflows while the element is away.
function Morph({ ref, layoutId, name, as = "div", style, children, ...props }: MorphProps) {
  const { isActive, isPrev, navigateStore, routerId: screenRouterId, transitionName } = useScreen();
  const nearestRouterId = useContext(RouterIdContext);
  const stores = useStores();
  const store = navigateStore ?? stores.navigate;

  // A morph inside a RESTING deep screen pins its status, exactly like <Part>:
  // without the pin every navigation would flip every stacked screen's morphs
  // through PUSHING→COMPLETED, re-running their registration on elements
  // nothing can see.
  const status = useStore(store, (state) => (isPrev ? "COMPLETED" : state.status));

  const elementRef = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      elementRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  // A layout effect, because the contract is "registered before the browser
  // paints the frame this element mounted in": the runtime measures the arrival
  // and stages it inside this window, so a morph never shows one frame of the
  // element sitting at its destination.
  //
  // Re-registering on every status change is intentional and cheap. It is what
  // lets a screen that was never frozen (a shallow-freeze session, a live
  // previous screen) still take its side of a pop, since nothing else would
  // tell the runtime the flight had begun.
  // Whether this element is inside a screen at all — see the note below.
  const owns = !!navigateStore;

  useLayoutEffect(() => {
    const element = elementRef.current;
    /* v8 ignore next -- the ref is set in the same commit the effect runs in;
       the guard is for a consumer rendering `as` into something React does not
       give a node for. */
    if (!element) return;
    return attachMorph(element, {
      layoutId,
      name,
      navigateStore: store,
      // Handed over rather than stamped: the runtime writes it onto the element
      // only where the DOM cannot answer for it (see AttachMorphOptions).
      ownership: owns ? { status, active: isActive } : null
    });
  }, [layoutId, name, owns, store, status, isActive]);

  // WHICH FLIGHT THIS ELEMENT IS ON, said out loud.
  //
  // The runtime used to infer it from the nearest `[data-flemo-screen]`
  // ancestor, which is right for anything written inside a screen and wrong for
  // SHARED CHROME: a shared bar is rendered as a sibling of the screen scope it
  // belongs to, so the walk leaves the screen entirely (root Router) or lands on
  // some enclosing Router's screen (nested). Both ends of a bar-to-bar pair then
  // resolved to the same non-transitional screen and the pair never flew.
  //
  // Structure cannot answer it, so the binding does — it is standing in the
  // enclosing Screen and simply knows. Same protocol `<Part>` already renders,
  // for the same reason: the enclosing screen's owner wins inside a screen, the
  // nearest Router outside one.
  //
  // ONLY INSIDE A SCREEN. `navigateStore` is absent in the default screen
  // context, which is exactly the case of persistent chrome that lives outside
  // every screen — a mini player beside the <Slot>. That element has no side of
  // a flight to be on, and the runtime's "no screen at all is a real partner"
  // rule is what pairs it today. Stamping a status and an active flag there
  // would answer a question it does not have, and on a pop the answer would be
  // "arriving".
  const ownership = owns
    ? {
        "data-flemo-transition": transitionName,
        "data-flemo-router": screenRouterId ?? nearestRouterId ?? undefined
      }
    : null;

  return createElement(
    as,
    { "data-flemo-morph-slot": "", style: { display: "contents" } },
    createElement(
      as,
      {
        ref: setRef,
        "data-flemo-morph": "",
        "data-flemo-morph-name": name,
        ...ownership,
        style,
        ...props
      },
      children
    )
  );
}

export default Morph;
