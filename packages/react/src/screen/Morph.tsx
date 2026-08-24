import {
  createElement,
  useCallback,
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
  const { isActive, isPrev, navigateStore } = useScreen();
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
  useLayoutEffect(() => {
    const element = elementRef.current;
    /* v8 ignore next -- the ref is set in the same commit the effect runs in;
       the guard is for a consumer rendering `as` into something React does not
       give a node for. */
    if (!element) return;
    return attachMorph(element, { layoutId, name, navigateStore: store });
  }, [layoutId, name, store, status, isActive]);

  return createElement(
    as,
    { "data-flemo-morph-slot": "", style: { display: "contents" } },
    createElement(
      as,
      {
        ref: setRef,
        "data-flemo-morph": "",
        "data-flemo-morph-name": name,
        style,
        ...props
      },
      children
    )
  );
}

export default Morph;
