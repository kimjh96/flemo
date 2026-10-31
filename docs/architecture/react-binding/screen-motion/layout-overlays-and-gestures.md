# ScreenMotion layout, overlays, and gesture integration

This supplement describes the supplied `packages/react/src/screen/ScreenMotion.tsx`. It complements [ScreenMotion](../screen-motion.md), [holds and release](holds-and-release.md), and [chrome and measurement](chrome-and-measurement.md). It establishes binding wiring, not the implementation of imported helpers or new browser-test results.

## Screen layout and painting

Root screens and their viewport chrome use fixed positioning; contained screens use absolute positioning. The outer container sets `visibility: hidden` when `paintHidden` is true, independently of Activity effect teardown. It uses `isolation: isolate` for stacking and `contain: style`, with ordinary stack position `zIndex + 1`. Park-under temporarily uses `zIndex - 1`.

The content wrapper has no explicit transform or compositing promotion. Scroll overflow is placed on that wrapper when `contentScrollable` is true and on the scope when false. A positive viewport scroll height hides the bottom shared-bar spacer, bottom shared bar, and system-navigation chrome. Horizontal swipe authoring sets `touchAction: pan-y`; vertical swipe authoring sets `pan-x`.

Children mount with the screen inside the layer providers. There is no release-gated shell-first child mount in this implementation. Entering inline styles are withheld for park-under and park-over; consumer `props.style` is spread last.

## Overlay host and decorator placement

Only a screen without an inherited layer host renders a host. Nested screens reuse that outermost host while publishing their own `LayerOwner` value. Host state, rather than a ref alone, makes target availability trigger rendering.

The host is an absolute full-size sibling of the animated scope, uses `OVERLAY_LEVEL`, and has `pointerEvents: none`. It carries the screen's transition, status, active, and hold attributes. It adds no explicit containment or promotion.

Each owner value supplies stack position, paint-hidden state, transition name, status, active state, hold value, screen ID, whether this screen renders the host, and `registerSlot`. The supplied callback adds non-null slots to a Set; a null registration clears the entire Set. `hasLayerSlot` follows whether that Set is nonempty. The unseen Layer consumer's registration behavior is not verified here.

Without a registered slot, the decorator renders locally. With a registered slot and an available host, it renders through a portal at `zIndex * 2 + 1`. The local and portalled branches are exclusive, preventing two simultaneous dims. If a slot is registered before a host is available, neither decorator branch renders. Both branches use the same decorator ref and hold attribute.

The engine receives the live outer `screenContainer` so core can discover layer riders, and resolves the Router's part layer through `resolvePartLayer(stores.navigate)`. The swipe controller resolves that same part layer. The binding does not hold a direct ref to every escaped overlay.

## Measurement lifetime

Bar attachment measures before registration and writes the spacer immediately. Positive measurements update refs, local state, and the shared-bar store; nonpositive measurements are ignored by these callbacks. Matching partner metadata seeds the initial spacer until a local measurement is available.

Height observers depend on bar presence and the measurement callback, not on the consumer's JSX node. This avoids observer teardown on every consumer render. A separate layout effect calls `publishRideBox(screenRef.current)` only while at least one shared bar exists, supplying screen dimensions for riding geometry.

Surface registration reads the scope's computed background color through `isOpaqueColor`, rerunning for background-color and status changes. This is the binding's evidence for partner opacity; it is not a claim that every overlapping visual surface is opaque.

## Gesture and morph lifetime

The stable controller reads current transition and screen state through `swipeEnvRef`. Readiness requires a non-root active screen, COMPLETED navigation, IDLE drag status, resolved swipe options, and viewport scroll height below 10. Pointer handlers forward native events, including lost pointer capture. The non-passive touchmove listener prevents default only when the controller requests it; effect cleanup removes the listener and calls `abandon`, including when Activity disconnects effects.

A committed swipe calls the owning Router's `stores.driver.back()`. It does not directly call browser history, preserving the selected Router backend.

At drag start, settle any retained morph handle with `(false, 0)` before calling `beginMorphSwipe(stores.navigate, "POPPING")`. Progress calls `scrub`; settlement forwards the commit verdict and duration, then clears the ref. These callbacks establish integration and orphan-handle recovery at the next start, not independent proof of the imported controller's teardown behavior.

Resolve transitions quietly during render and resolve again in an effect for diagnostics. Resolve swipe options through `resolveSwipeOptions`, supporting the resolver's accepted authoring forms rather than reading only a legacy direction field.
