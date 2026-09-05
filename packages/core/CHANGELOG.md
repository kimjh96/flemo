# @flemo/core

## 2.3.1

### Patch Changes

- [`4dbd635`](https://github.com/kimjh96/flemo/commit/4dbd635250a46b61a08035232929b5c41e179827) Keep a hydrating Router's first render equal to the server's. A Router adopts
  the identity of the browser entry it mounted on, so a traversal back onto that
  entry matches by id rather than colliding with every other scope's generic
  "root". That adoption reads `window.history.state`, which the server cannot see,
  and it ran inside the store initializer, which for a hydrating tree is the one
  render that must agree with the server HTML.

  `history.state` survives a reload, so a refresh on a page that had pushed seeded
  a generated id where the server had written "root". React does not patch a
  mismatched attribute, so the DOM kept `data-flemo-screen="root"` while the store
  believed the other one, leaving the engine and the document disagreeing about
  which screen this is for the life of the page. Reported from a browser as a
  console error after refreshing the home page; reproduced by navigating out of a
  nested Router's zone and back before reloading.

  The adoption is now deferred to the commit after hydration, so the first render
  matches and the entry's identity still arrives. `createRouterScope` takes
  `deferEntryAdoption` and core exports `adoptEntryIdentity` for a binding to call
  once hydration is over; a scope created later on the client still adopts in the
  same render, as before.

## 2.3.0

### Minor Changes

- [`ecf196e`](https://github.com/kimjh96/flemo/commit/ecf196ea1e732834766f68d12623c53b10931d8b) Write a morph's pairing key into the DOM as `data-flemo-morph-id`, and export
  the morph attribute names (`MORPH_ID_ATTR`, `MORPH_CAMERA_ATTR`,
  `MORPH_GHOST_ATTR`, `MORPH_STAND_IN_ATTR`) alongside the ones already public.
  A shared element that fails to pair produces no error, no attribute and no
  animation, so the single most common morph failure was invisible to everything
  outside the runtime; with the key on the element an inspector or
  `@flemo/devtools` can group the two ends itself and report a pair that never
  flew. Copies the runtime makes (the stand-in and the ghost) drop the key with
  the rest of their identity.

  The transition name and the pairing key are written only when they change. A
  morph is re-registered on every status change, and an attribute write
  invalidates that element's style: the unconditional write was one invalidation
  per morph per navigation, on the same bench where exactly that cost was
  device-measured as judder.

### Patch Changes

- [`c5bf427`](https://github.com/kimjh96/flemo/commit/c5bf42734ec7dcc596672b72adb0cbf66d5c327b) Read a swipe's travel off the screen it is dragging instead of off the raw
  pointer offset. Every handler clamps its screen at rest, so a finger that came
  back past where the drag began left the screen still while the absolute offset
  kept growing: the dim went on lifting off a screen that was not moving
  (measured at opacity 0.28 with the screen at translateX(0)), and a release
  there told the settle most of the trip was already done, so a commit crossed
  the whole screen in the time left for its last few pixels. The gesture's travel
  is now the signed offset along the swipe axis clamped to that screen, which
  also stops a drag past the end from growing the remaining distance again.

  Two more release-clock corrections ship with it. The finger is now measured at
  the moment it lets go rather than at its last move, so a gesture carried across
  and then held still no longer lands at the speed it had before it stopped. And
  a landing may no longer outrun the authored motion by more than three times its
  own average speed, which is what turned a fast flick into a cut: the previous
  floor was a flat 0.12s, generous for the last twenty pixels and a teleport for
  a whole screen.

## 2.2.2

### Patch Changes

- [`d613c10`](https://github.com/kimjh96/flemo/commit/d613c1004c1bc57585b3c8ebc530954b8a4a10b1) Let a morph's box grow on WebKit. An element that animates a custom property has its animated `width` dropped there: the size holds its first keyframe for the whole flight and jumps to its last on the landing frame, while the position it is driven by runs correctly. Reported from a consumer's tab switch as a pill whose contents were clipped for the whole flight and snapped open at the end. The box's size now travels the way its position already does, through registered lengths the element reads, so the engine has nothing but custom properties to interpolate. Measured on the same switch, the width went from one value across the flight to tracking its position frame for frame.

- [`4aab461`](https://github.com/kimjh96/flemo/commit/4aab46177e6e8c6ae7daafb5da6118358db8741c) Paint the departure through a flight's head, and hand over with a step. The head is a flat lead-in in which nothing has moved yet, and what belonged on glass for it was the arrival: the destination's contents at the departure's size, because the copy that paints the departure was gated on a cross-fade and a zero cross-fade meant no copy at all. A zero cross-fade is a cut, not an absence, so the copy is made either way and cuts at the moment the box starts moving. That cut is a step on both sides rather than two crossing ramps, which never compose back to what they replaced, and the arrival waits behind an opacity low enough to keep its raster warm rather than at nothing at all.

- [`d613c10`](https://github.com/kimjh96/flemo/commit/d613c1004c1bc57585b3c8ebc530954b8a4a10b1) Lift a shared bar's parts before the flight is painted, not two frames into it. Staging waited on the `bar-riding` flag, which the binding computes from the partner's registration and therefore publishes one render late, so the covered side's `<Part>` was re-parented after two frames had already been drawn with it in place. WebKit rebuilds the layer of a live element it re-parents, which reads as the part blinking out and back before its partner fades in. Whether a bar is handed over is now read from the DOM the flight starts with, where the partner's copy is already present.

- [`e1097bb`](https://github.com/kimjh96/flemo/commit/e1097bbd8b84a60ffa57ab91129a092469b80470) Spend a flight's head inside its animation rather than in front of it. A head waited out as a delay leaves the animation uncommitted until the instant it must move, so a first frame that arrives late arrives partway through the curve and the opening is never drawn: painted frames off a phone at 60fps put the first frame a box appeared on at 67% of its travel. Baked as a flat stop the same seconds hold the from-pose while the animation is already running, and a late frame lands inside them. The ghost, the paint channels, the type staircases and the camera all ride the same lead-in, so the flight stays one composition.

- [`29a2e58`](https://github.com/kimjh96/flemo/commit/29a2e58aa7f7d5bbadf36527ced529b21c02f825) Pair a `<Morph>` rendered in a shared bar. A shared bar is a sibling of the screen scope it belongs to, so the nearest `[data-flemo-screen]` above it belongs to another Router or to nothing at all, and both ends of a bar-to-bar pair resolved to the same screen and never flew. The binding now stamps the flight it is on, and the runtime reads the side from that while still taking its transform correction from the screen it is physically inside.

- [`eb5dfbd`](https://github.com/kimjh96/flemo/commit/eb5dfbd0fce54bfd463e6480244264637f008cc2) Cancel the drift a growing run of text picks up on faces whose glyph advances do not track their size. The run's width is measured off-screen at sixteen sizes along the flight and the deviation from the straight line between its ends is spread over the gaps as tracking, so later characters stop wandering further than earlier ones. A run has to be at least half a pixel off that line before anything is emitted, because tracking reaches the glass on a 1/64px grid and a correction below it can only add a staircase of its own. Named families sit on the line already and are left completely alone; `system-ui` and `-apple-system` deviate by a full pixel in both engines, and now land within a face that never had the problem.

- [`7bb89ee`](https://github.com/kimjh96/flemo/commit/7bb89eebbc4c21c2b785df11187bc608cf1b7b44) Hold an edge that both ends of a morph agree on. A travelling box carries its position on one channel and its size on another and the engine rounds each to its own layout unit, so a far edge reached as their sum oscillates even where both ends put it in the same place: measured on a consumer's pill, 366.000 give or take 0.015, reversing six times in twenty-three frames, with every right-aligned thing inside following. The element is now placed from that edge through the same channel its width animates on, so the two round together. Where such a pair also shares its height, the box is held at the wider size and the narrower end is a clip over it, which is the one case where a size that animates every frame is re-rastering a picture that never changes.

- [`39ae3dd`](https://github.com/kimjh96/flemo/commit/39ae3dd30dc5f7d9582f2c24d6f42a88ea7ef0b2) Find a type morph's face boundaries by bisecting the flight itself instead of aiming from the face's per-em ratios. An engine whose rounding drifts off the ratio arithmetic used to lose a stop, and a lost stop landed its whole step one frame before the landing, read on iOS as a meta line dropping a pixel at the end of every zoomed pop.

- [`911e97c`](https://github.com/kimjh96/flemo/commit/911e97c30b0c5e72af4dd850784c08c2342f6294) Lay a `<Part>` inside a flying morph out at the width it rests at, rather than at every width the box passes through. A page of copy inside a growing card re-wrapped mid-flight and the content under it jumped a line up the screen, after the part had already been brought back to full opacity.

- [`8664957`](https://github.com/kimjh96/flemo/commit/86649576adb7bb1960df883972baed2e096bd2d3) Land a flight on the state it rests at. A flight now reaches its destination one frame before it ends and holds there, every staircase reaches its last value before the landing rather than at it, a leading travels as its own channel wherever the size does, type lengths are written at the precision they have, and a box is never measured for its resting size while the layer is holding it. Read every computed style once per flight instead of three times.

- [`63cde53`](https://github.com/kimjh96/flemo/commit/63cde53da338309e6a4aa139d255b71ec16e1c2c) Stop measuring a morph that has no container to be staged inside. Registration runs in a layout effect, in the frame React has just mutated the DOM, so the measurement it took was a synchronous layout of the whole page at the most expensive moment there is, repeated for every render of every morph. The value is only ever read to beat a staged container, which an element with no morph above it does not have. Device-read on a consumer's tab switch: one call at 25ms after the landing and one at 9ms at the tap, on a navigation with nothing nested in it at all.

- [`5a7d4d4`](https://github.com/kimjh96/flemo/commit/5a7d4d460a0a20ca82a213464c77623978838653) Lay a morph's box out once where its own contents were measured not to move, and cut the growth back with a clip instead, so a subtree that has nowhere to go is no longer re-laid-out and re-rastered on every frame of a flight. Hold the far edge on the engine's layout unit so it can no longer oscillate by a 64th of a pixel between frames.

- [`50a1222`](https://github.com/kimjh96/flemo/commit/50a122244b8d1c7d99df7ec634933fc811984a0c) Stop a shared-element text morph starting compressed and a shade high. The copy that covers a flight's lead-in was stamped with the ARRIVING element's inherited values (letter-spacing, colour, line-height) rather than the DEPARTING element's, so the departing words rendered in the destination's tighter face and a pixel out of place until the flight moved. The copy now replicates the departure exactly, taking the departure's own computed values. The ascent cancellation is also held flat through the lead-in, so the line no longer sits low before the first frame moves.

- [`b0ac25d`](https://github.com/kimjh96/flemo/commit/b0ac25d862258bfc0dbd98f4313ceb2ea96fd239) Render a screen's dim once. A screen with a `<Layer>` slot rendered its decorator twice, once in its own container and once out in the layer host, so the dim painted twice over and read 19% where the decorator asked for 10%. The copy in the host is the one that covers what an overlay carried out, so it is now the only one, and every handle points at it. A drag also reaches it: the decorator's riders no longer wait on a bar-part staging that a screen with no shared bar never satisfies, and the covered screen's dim is found by the screen that owns it rather than by where it sits.

- [`495b181`](https://github.com/kimjh96/flemo/commit/495b181fb8544b94ffaf508390d130384fd3c639) Start a morph on the same frame as the choreography around it. A flight's layer sits outside the screens, so the compiled hold cannot reach it through them and the runtime mirrors a hold onto the layer instead. It mirrored only the end whose transform displaces the element, which on a nested Router's tab switch read released while the other end sat parked: the morph ran alone, and by the time the shared bar's parts began their cross-fade the button had travelled 42% of its flight. The flight now waits while either of its ends is held, and reads that hold from the box that carries the end rather than from the end itself.

- [`64056ca`](https://github.com/kimjh96/flemo/commit/64056ca87d8c40d6df7889858e7cf7ca7aab3e7e) Count a replace's head once. Four rules bake the same flat lead-in and a replace shifts none of them, but the parked arrival's rule still shifted by one, so it began its fade a whole head after the departure had finished its own and the one dissolve the author wrote played as two. Parts also ride the head as keyframes now rather than as a bare delay: a delay leaves the animation uncommitted until the instant it must move, so a first frame that lands late lands partway down the curve and the opening is never drawn.

- [`5ef2915`](https://github.com/kimjh96/flemo/commit/5ef2915d16d56e8ccacd947164b67ad93b42ebf9) Hand a morph's ownership to the runtime instead of stamping it on every element. The binding marked each `<Morph>` with the status and active flag of the screen it belongs to, and both change on every navigation, so every morph on the page had two attributes rewritten each time one happened and every one of those subtrees had its style invalidated. Measured on the playground's zoom bench, whose list carries thirty-three of them, the pop's camera juddered as it converged on Safari and stopped the moment the two writes did. The values are only ever read where the DOM cannot answer for itself, which is shared chrome rendered outside its own screen, so the runtime now writes them there and nowhere else.

- [`5312fb3`](https://github.com/kimjh96/flemo/commit/5312fb3f309b8c0ec1d2f53ae4cb1b894a7b0c58) Pair a shared element against its captured snapshot even when the leaving screen has not yet re-rendered its transitional status. A fast pop's container morph could otherwise find its partner only in the snapshot, on a screen still reading COMPLETED, be refused, and leave its camera unstarted and its children flying as bare morphs — the intermittent zoom swallow with blinking text.

- [`f0cdd43`](https://github.com/kimjh96/flemo/commit/f0cdd43274a75428c9656ef6ce1fa5bea0a8f595) Measure a flight in rest space by taking every ancestor pose back off the rect. A transition puts its from-pose on whatever its selector names, and a morph was undoing only a screen's, and only when the Router matched: a shared bar sitting inside another Router's screen had its arrival measured with the transition's shift still on it and never taken off, so the flight was placed a whole shift out and snapped back at the landing. Displacement is a property of the boxes above an element, not of any Router, so it is now read from the boxes.

- [`8188ee4`](https://github.com/kimjh96/flemo/commit/8188ee4319656e84126c7644c8e71844c4dda1d6) Complete a transition when the morph camera carrying a still screen actually lands, not ~200ms earlier. A `zoom` morph pairs with a screen whose own transition animates nothing, so the engine was resolving the task on that absent clock and flipping COMPLETED while the camera was still zooming, which showed as a stutter on the pop right before the screen settled. The task now spans the camera's animation, so the completion lands with it.

- [`5ed45c9`](https://github.com/kimjh96/flemo/commit/5ed45c9b04b245d7fb868566c2dc58da4407d67a) Never pair a pop against a morph left stranded in the flight layer, and sweep such corpses at the start of every navigation. An interrupted storm (a tab switch tearing a screen down mid-flight) could leave a hoisted morph in the layer with its role still set; a role-bearing element with no owning screen read as a partner already in the air, so every subsequent pop paired against it instead of the grid, swallowing the camera and blinking the text until reload.

- [`d7518a2`](https://github.com/kimjh96/flemo/commit/d7518a2bb576508b6ecb5263ec460c7218c27b55) Land a camera on the pose it rests at: the zoom that carries a screen now reaches its endpoint one frame before it ends and holds there, so the landing no longer releases a sliver of scale that moved everything on screen by its distance from the origin.

- [`37694bd`](https://github.com/kimjh96/flemo/commit/37694bdd6247bcc947d37745ca6e89015ae4514d) Ignore a pop that lands while a transition is in flight, the same first-tap-wins guard push and replace always had. A back tapped during a pop used to queue behind the running flight and run against a half-cleaned stack, cutting a zoomed pop to rest with no camera and no text morphs.

- [`6335d3a`](https://github.com/kimjh96/flemo/commit/6335d3a08d9d77144723df6eaefebcd5a55c1840) Start a type morph on the line the departure drew. The leading staircase holds the arrival's leading from the first frame, so a title resting at a 20px line began its flight at 18px and its glyphs a whole pixel high while its box sat exactly where it should. The flight now pays that half-leading on the same channel the ascent's cancellation rides, measured on the grid the engine put both ends on.

  Wear that channel wherever it is written. A pair riding its container has no box and no pose of its own, and the declaration that reads the channel asked for one of the two, so both registered properties animated with nothing reading them and the whole cancellation was dead on exactly the pairs a container transform is made of.

- [`bf30ff3`](https://github.com/kimjh96/flemo/commit/bf30ff39a9e317fd26f44ea48aab2cf88926d8aa) Carry a type morph's ascent cancellation on the same channel its position travels on, so it applies to every pair rather than the ones that happened to have a spare property. A pair riding its container writes its own transform and had nowhere to put the cancellation, which left the baseline stepping on exactly the flights a container transform is made of.

- [`29a2e58`](https://github.com/kimjh96/flemo/commit/29a2e58aa7f7d5bbadf36527ced529b21c02f825) Stop stating a travelling element's box twice. Staging wrote an inline `width` and `height` that the travel keyframe also animates, which is the same value from two cascade levels for no benefit. The keyframe states the box for every frame of the flight, so it is now the only thing that does.

- [`0eb4bf7`](https://github.com/kimjh96/flemo/commit/0eb4bf78261e7b0d43015c4c0ca0618f4951d6a1) Thin a type morph's leading staircase so no two steps land in the same frame. A fast-opening ease packed several one-pixel steps into the opening frames, and each step is a moment the line-height (a paint) and the lift (a transform) can present a frame apart, which the eye reads as a shimmer. Merging sub-frame-spaced boundaries keeps the staircase and its end boundary while cutting the shimmer.

- [`85e66e2`](https://github.com/kimjh96/flemo/commit/85e66e2b4e34afe1235870b3c14cb3d171c704af) Stop emitting a compiled rule for every transition-and-part pair whose clock is the one the part's by-name rule already carries. A part that authors its own duration resolves to the same clock under every transition, so its per-transition twin only inflated the stylesheet the browser re-matches on each navigation. The reference playground's sheet drops from 2049 style rules to 531 with no change in behavior.

## 2.2.1

### Patch Changes

- [`7594fca`](https://github.com/kimjh96/flemo/commit/7594fca26e2351cd2f4c80e258d403dc7593fedb) Carry a type morph's baseline smoothly while its size travels. Holding the leading still left the glyphs stepping anyway, because the baseline sits an ascent below the line's top and the ascent climbs the same pixel grid the leading does. Neither can be made smooth, so the flight now sends the box the other way by exactly as much and the two cancel.

- [`ba00e4b`](https://github.com/kimjh96/flemo/commit/ba00e4ba3f3023dbc7cfb7b1d10a5b147c228bc3) Hold a type morph's leading still for the whole flight. A line-height that interpolates smoothly against a face height that climbs in whole-pixel steps is a sawtooth, and it crossed the grid the engine renders leading on three times per flight on desktop Chrome, which read as a tremor with the type nudged down a moment after it landed. The line-height now climbs the same steps the face does, read off the font itself rather than measured with layout, and an engine whose face height is continuous is left exactly as it was.

- [`702fec3`](https://github.com/kimjh96/flemo/commit/702fec3aab535e1c89c5932f704fed2a252ac5f3) Compile the transition stylesheet once per registry rather than once per registration. A Router's definitions are usually an array literal, so its registration effect tears down and re-runs on every render, recompiling every keyframe twice for a set that did not change. Profiled on a stack holding several Routers, that was a 237 ms frame on every navigation, growing with each one.

- [`ba123f1`](https://github.com/kimjh96/flemo/commit/ba123f1d3b9364e279627455c4dbf1ad594eb86a) Hand a swipe's morph and riders back by placing their start time rather than calling `play()`. A pending play resumed at a time each engine resolved differently, so on WebKit the shared element froze at the pose the finger let go of while the screens slid out from under it, then jumped to the arrival in one frame.

- [`a477e51`](https://github.com/kimjh96/flemo/commit/a477e510ccdf18730a4a7ce4b86df3b6c80f9d66) Only carry a type morph's ascent backwards where there is a box to carry it on. A nested pair riding its container has no box channel, so the transform that takes the ascent off was emitted with nothing to send the box up by the same amount, and the line started an ascent too high. Reported from the poster grid as a title jumping twelve pixels up at the first frame.

- [`ddb6d02`](https://github.com/kimjh96/flemo/commit/ddb6d02d1d28317726c1b51a7632f6bc2ac57aa8) Keep a morph's leading inside one step of the grid its engine puts lines on. Both engines floor the half-leading, and an interpolation only holds its endpoint from the instant the flight lands, so a line whose arrival half-leading sits on a step rendered one down for the whole flight and dropped there at the landing. The grid is not assumed: whole CSS pixels and device pixels are both tried, the one that reproduces what both ends actually rendered is used, and the correction stands down when neither does.

- [`8a8b56d`](https://github.com/kimjh96/flemo/commit/8a8b56dfc3e1cd83ae1d5e547f2307f714c277e6) Present every part of a morph flight on the thread that presents the element it is placed against. A ghost, a nested pair and a `carry: "screen"` camera were each free to be run by the compositor while the element travelled by its box on the main thread, so they advanced on frames the element never reached. This applies to any transition, authored or preset, rather than to any one of them.

- [`6bdf48b`](https://github.com/kimjh96/flemo/commit/6bdf48b5077e87543541d8b43ef6f3b1c1faafaf) Drive a flight's position through registered properties, so it stays on the thread its size is on. WebKit runs a `translate` on the compositor even where the same keyframe animates a `width`, which left a line of type's position running ahead of its own size and reading as the text arriving late. Where the properties cannot be registered the position goes back to `left` and `top`.

- [`0cede61`](https://github.com/kimjh96/flemo/commit/0cede6143cb6db6ade0ffd476fd510477b8fe25d) Bound a parked screen's opacity by the composite rather than by eye. A park is drawn over its cover, so the most it can move a pixel is its opacity times the two colours' distance, and an eight-bit composite steps at 1/255 — under that it cannot move one whatever it is drawn over. At 0.02 it was five steps, and a tab switch parks a whole screen for the length of the hold: reported on iOS Safari as the next tab showing through before its transition.

- [`f352397`](https://github.com/kimjh96/flemo/commit/f35239705bd12d133886c5459e8861147100d4cc) Stop reading a fractional layer layout as a scale. `offsetWidth` is rounded and the painted box is not, so a stage sized by `aspect-ratio` against a viewport that is not a round number inflated every staged rect by up to half a pixel, and the flight stepped that far at the landing.

- [`ddb6d02`](https://github.com/kimjh96/flemo/commit/ddb6d02d1d28317726c1b51a7632f6bc2ac57aa8) Hold a text morph to one line for the length of its flight. The flying element is the arrival's tree, so it re-wrapped at every width between the two ends under rules nothing chose for the widths in between: a cell's meta line broke after its middle dot at the small end of a push and unwrapped four frames later.

- [`52078fb`](https://github.com/kimjh96/flemo/commit/52078fb80623140a62ed98d0185baff33502001f) Move a flight's position from `left` and `top` onto `translate`, keeping the size on layout. Blink paints text at a layout position on whole CSS pixels, so a line of type travelling by its box stepped a full pixel at a time while every layout measurement of it reported a smooth curve. The size still animates, so the words still re-typeset on the way.

## 2.2.0

### Minor Changes

- [`28d0377`](https://github.com/kimjh96/flemo/commit/28d03778381fbd5c761712cf8b827aaf0b60a23e) Remove the `flemo:*` diagnostic flag surface from the shipped library. Core read
  24 session keys and exported the registry that described them, so every key
  string and every explanation shipped in a consumer's bundle; each key is now a
  computed default with no override. `DIAGNOSTIC_FLAGS`, `RETIRED_DIAGNOSTIC_FLAGS`,
  `parkHeadEnabled`, `restLayerPromotionEnabled` and `PlatformProfile.restLayerPromotion`
  are gone from the public API, and the machinery only a flag could arm goes with
  them: the image reveal hold, the REST-time layer promotion, the resident-layer
  and shallow-freeze experiments, and the morph decision trace. Per-browser
  behavior is unchanged, because no consumer set these keys. `@flemo/devtools` now
  lists every engine key as retired residue, so a device still carrying one is told
  it explains nothing.

  Released as a minor rather than a major on purpose: the removed exports described
  a diagnostic surface nothing consumed at runtime, and `@flemo/devtools` mirrored
  the registry through a test-only dependency rather than importing it.

- [`429599d`](https://github.com/kimjh96/flemo/commit/429599d7ffc022467b9301184d6e746d9c1bada1) Cross-fade a shared bar's `<Part>` elements between screens that match on `sharedTopBarId` or `sharedBottomBarId`. Both sides already received the right status and ran the right keyframes, but each screen renders its own copy of the bar inside its own isolated container, so the covered screen's part animated under the other screen's opaque surface and was never seen. On a pop it was worse than invisible: the returning part finished its enter animation while occluded, then appeared un-transitioned the moment the departing screen was released.

  The covered side's parts now spend the flight in a Router owned part layer above both screens, at the rect they occupied, and go back exactly as they were on landing. A stand-in holds the part's place so the bar keeps its layout while it is away. This works on push, pop, replace and the interactive swipe, and needs nothing from the application: no bar z-index to coordinate and no selectors on internal `data-flemo-*` attributes.

  A `<Part>` also takes its clock from the flight carrying it, which is the rule decorators already follow and by the same same-variant-key mapping. A part states a pose; how long the hand-over takes is the flight's answer and the flight already gave it. Restating it is how the two drift apart, and omitting it used to resolve to zero: the part snapped under a screen running for three quarters of a second, while a part authored longer than its screen held the whole flight open and disabled swipe-back for as long as it ran. A part's variant states its clock optionally, the way a decorator's already does, so a pose can be written without one.

  What rides a flight now follows the finger too. A drag flips no status, so the compiled rules never matched and a `<Part>` or a decorator that declared only a pose sat still while the screens moved under it: only an author who hand wrote `onSwipe` got anything, restating in imperative code the pose they had already declared. The gesture now stages those animations itself and scrubs them, which is the model `<Morph>` has used since it learned it, and an authored `onSwipe` still overrides. A committed swipe marks each rider so the landing does not replay it from its start, the contract the swipe already applied to the screen and the dim.

### Patch Changes

- [`e0cb632`](https://github.com/kimjh96/flemo/commit/e0cb632d620e712e8407c8f850ed6019e7024142) Give each history its own serial lane for navigation tasks. A `history="memory"` Router no longer queues behind unrelated Routers on the page, so a looping in-memory demo can no longer delay a real navigation.

- [`8608b73`](https://github.com/kimjh96/flemo/commit/8608b73536c305d0410489f55aeb6834a4ab9849) Recognize the parked heads' `animationend`. Their keyframe names were never added to the suffix list, so a parked flight never resolved on its own animation and the restart watchdog replayed the whole transition.

- [`472432c`](https://github.com/kimjh96/flemo/commit/472432c6e6c7c951975437fbedf9dc8530e92de2) Keep a screen's pre-raster alive across the head that follows it, so a pushed
  page taller than the viewport no longer slides in blank below the first tile row
  and fill in near the end of the transition on iOS Safari. It applies wherever
  the engine parks a screen: every authored transition, however it hides one, on
  both the entering and the covered side. Set `flemo:parkhead=off` to compare
  against the previous behaviour.

- [`6975302`](https://github.com/kimjh96/flemo/commit/697530271edafea590ebf95e7ce3bfaf2a04cfb6) Stop giving a `Part` its own compositing layer. Safari presented that layer at the part's static opacity while the animation ran, so a departing part held full colour through the flight and was cut at the end instead of fading.

- [`207444c`](https://github.com/kimjh96/flemo/commit/207444c2a9ddcf0705308a26fb56cf079488344f) Start the render-settle gate watching with the transition instead of after its paint anchor, so a pop's Activity unfreeze is seen by the gate that exists to keep it out of the motion. Drop the mount grace for screens that are not mounting, which removes about 50ms of frozen flight from every pop.

- [`82930e8`](https://github.com/kimjh96/flemo/commit/82930e8e4e3bb12838d21dd9ed3427d1d5c75443) Stop the compositor warm-up from being visible. Its element drops from 0.02 to
  0.006 opacity after a consumer reported seeing the 48x48 patch on an iPhone in
  the moment before a transition, and it is now session-resident so a tap no
  longer pops it in and out on the navigating path. The steady-60 desktop cadence
  video is removed outright.

## 2.1.0

### Minor Changes

- [`18ac23f`](https://github.com/kimjh96/flemo/commit/18ac23ffd88196f13097a7729832b4e7b9076793) Run a decorator on the clock of the transition that names it. Timing on a decorator variant is now optional and inherits the screen's duration and delay for the same variant key, so one dim is longer on a slow transition and shorter on a fast one without being authored twice; write a `duration` only to override it, including `0` to snap, and note that a variant that previously omitted one snapped where it now inherits. `ease` is never inherited.

- [`17219e6`](https://github.com/kimjh96/flemo/commit/17219e621d7932564299e28358abf47327d53079) Measure a drag's progress against the screen it drags, not the window. A decorator's and a part's swipe hooks now receive the gesture's own progress as the 0 to 100 they are documented to take, supplied by the controller rather than by whichever transition happens to be running, so a dim inside a nested Router follows the finger instead of crawling. `cupertino` maps its own progress and its commit threshold against the same box; a transition that passes a second argument to `onProgress` still compiles, but that argument is no longer read.

### Patch Changes

- [`c5f5e21`](https://github.com/kimjh96/flemo/commit/c5f5e2186d88ee679f5a26caa96c3457da51c41d) Settle a swipe the browser cancels instead of teleporting it. A `pointercancel` or a lost pointer capture used to snap the screen from wherever the finger left it back to rest in a single frame, because a forced cancel was treated as a tap and the neutral sample that stops it committing was also handed to the release clock, leaving it no distance to travel. The screen now walks home over a real reversal, while a genuine sub-slop tap stays instantaneous and a cancel still cannot commit a navigation.

- [`0c6f4ab`](https://github.com/kimjh96/flemo/commit/0c6f4ab5f6ff247acd863b09c2c81348cfe4efe4) Land a decorator's swipe release with the screens rather than ahead of them. A decorator's release now borrows the screens' authored span for the gesture scaling, so a swipe-completed pop holds the dim to the screen exactly as a button-driven one does; a handler's explicit `duration: 0` is still a snap, and a `<Part>` keeps its own span because it has no screen clock to take.

- [`9f95915`](https://github.com/kimjh96/flemo/commit/9f959156e5bcce52b540a665275ba94639662c7c) Fix a shared element making its trip twice after a swipe-back. A fast flick lands the gesture's morph before the navigation it commits stages, so the same element was flown again from its original position; the release now tells the navigation what it already delivered instead of leaving it to timing.

- [`1ca911b`](https://github.com/kimjh96/flemo/commit/1ca911b7be274785801e44e75ff650c124366a6b) Fix a swipe-back inside a `history="memory"` Router leaving the stack unpopped. A memory Router now mounts the history sync like a browser one, so the gesture's commit reaches its stores; without it the dismissed screen stayed active off-stage and swallowed every tap that followed.

- [`ce12ca5`](https://github.com/kimjh96/flemo/commit/ce12ca53e6cea863cc415868571a084d8fd0bf03) Fix a shared bar travelling the wrong distance under a vertical transition. A riding bar runs the screen's keyframes on its own box, so a percentage offset resolved against the bar's height instead of the screen's: a material push moved a 104px bar 104px while its 770px screen moved 770px, landing the bar alone at the top of a screen still off the bottom of the viewport. The bar now runs a copy of the keyframes measured against the screen box, and a swipe release resolves the same offset the same way. Horizontal transitions are unchanged, because a shared bar is already exactly as wide as its screen.

- [`0e54a0d`](https://github.com/kimjh96/flemo/commit/0e54a0d6a4eb345964654256426b1fec7783603d) Fix a shared element sitting still through a back-swipe and then making the trip on its own after the screens have landed. The gesture staged its morph flights before the covered screen had re-registered its `<Morph>` children, so it found no arriving partner and carried nothing.

- [`eaebb08`](https://github.com/kimjh96/flemo/commit/eaebb08ec576dc158af32e3a986451f575d4fdb6) Stop a mouse drag from losing the swipe to the browser's own gestures. Dragging across a screen's text started a native selection, which took the pointer away with `pointercancel` and force-cancelled the gesture; selection and image-drag are now suppressed for exactly as long as a gesture holds the pointer.

## 2.0.0

### Major Changes

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Remove the `layoutId` navigation option. It was threaded from `push()` and `replace()` through the history frame, the browser's history state, the popstate bridge and the screen context, and nothing ever read it — shared elements are paired by the `layoutId` prop on `<Morph>`, which is a different thing entirely. Passing it to `push`/`replace` is now a type error; delete the argument.

### Minor Changes

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Let a swipe drive a morph. The shared element now stages its flight when the drag starts — both ends are already on screen, so the destination can be measured — holds it at zero, and follows the finger, then plays out to the arrival on a commit or back to where it started on a cancel, at the same speed the screens settle at. It runs no frame loop of its own: the animations are the browser's, and the gesture sets their time. Any transition that declares a `swipeDirection` gets this without authoring anything.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Shared-element morphs are now flemo's own, with no animation library behind them. `<Morph layoutId="...">` (from `@flemo/react`) marks an element that exists on two screens: the arriving one starts on its partner's BOX and grows into its own. It animates the box, not a scale — so the subtree lays itself out at every size on the way and paired text is re-typeset rather than blown up — and it carries a copy of what it replaces — painting only the parts of it that have no counterpart on the other side, so nothing is drawn twice — which dissolves away as it travels. For the length of the flight the element is staged in a layer above both screens, so no scroll container can clip it, no opaque arrival can cover it and no sliding transition can carry it along — which is what lets one morph look right under any screen transition, cupertino and material included. Morphs nest, and a nested one rides its container — so a card stays a card for the whole trip instead of coming apart in the air. A container, a whole screen, or a screen and the elements inside it are all the same feature at different sizes, and what happens BEHIND the element (a background that recedes and blurs, say) stays the screen transition's job: the two keep step because a morph with no duration of its own inherits the flying screen's. Author the choreography with `createMorphTransition`, exactly like every other flemo transition, or take the built-in `shared` preset: it inherits the flying screen's timing, so the element lands with its screen. The travel runs on the compositor as a single per-flight keyframe and obeys the same animation hold the screens do, so it starts on the same frame with no timing code on either side.

- [`98ede19`](https://github.com/kimjh96/flemo/commit/98ede190f0cdf8239b96a0c5fa78700bc69d700e) Add `<Layer>`, which renders a consumer overlay beside its screen so it can cover the shared bars while the screen is moving. The overlay leaves the screen for paint order only: it stacks by its owning screen, runs that screen's keyframes so it travels and leaves with it, and stops painting when that screen is covered. Screens now state their internal paint order (content under chrome, chrome under an overlay, the dim over all three) instead of inferring it from element order.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Add `carry: "screen"` to `createMorphTransition`, and a `zoom` preset that uses it — the container transform. A plain morph moves one element and leaves the screens to their own transition; `carry` also zooms the screen the element is small on by exactly the amount that takes the element from one end of the flight to the other, so a grid opening into a full-screen view reads as the camera pushing in on the tapped card rather than as the card escaping a grid that stayed behind. It works in both directions from one rule — the camera always rides the screen holding the smaller box, which is the departing screen on a push and the arriving one on a pop. It supersedes that screen's own transform for the flight, so pair it with a transition that leaves the screen still.

### Patch Changes

- [`e937f57`](https://github.com/kimjh96/flemo/commit/e937f5714581a36a52a9cbd961e3eca483307a56) Extend the proportional corner interpolation to per-corner radius lists, so a card whose image rounds only its top keeps each corner's own proportion through the flight.

- [`08f8494`](https://github.com/kimjh96/flemo/commit/08f8494be3fc0118c08fa7746e726c298253d9ea) Interpolate a square pair's border-radius as a percentage of its box, so the roundness the eye reads eases over the whole flight instead of collapsing in the first frames when the box grows severalfold.

- [`69ac179`](https://github.com/kimjh96/flemo/commit/69ac179a479706c2704be7f45497c136bd12b16b) Carry each endpoint's scrollport clip into the flight as an animated inset, so an element half-hidden at a list's edge slides out from under the chrome stacked there and slides back beneath it on return, instead of painting whole over the tab bar from the first frame.

- [`d006b5f`](https://github.com/kimjh96/flemo/commit/d006b5f729c9178acc2f633cd8fb521376f7e797) Capture an unset flex/grid gap as 0px so the gap paint channel interpolates instead of swapping discretely at the eased midpoint of a flight.

- [`fefc815`](https://github.com/kimjh96/flemo/commit/fefc8155a4dafdc614d9be4d2152569f71c9bbb9) Stop the `layout` transition wearing a dim on someone else's clock. It named the built-in `overlay` decorator, which is compiled once per decorator NAME with the durations its author wrote — 0.7s, sized for cupertino's 0.7s flight. `layout` runs 0.4s, so on a pop the dismissing screen was gone at 335ms while the screen underneath kept a 10% black wash for another 300ms: a grey cast appearing from nowhere and lifting for no reason, over a screen that is holding still so a shared element can be followed across it.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Rework the `layout` transition so one screen moves at a time. It ran `0.97 → 1`, which is not a fade at all: the arriving screen popped in whole and the dismissing one hard-cut — survivable only while its partner was a fully transparent screen, where the screens were never visible in the first place. A true cross-fade was worse, because two opaque screens at half opacity double-expose. Now a push fades the arrival in over a stationary screen and a pop fades the dismissal out over one, with a front-loaded curve that is done in the first third, and 0.4s in total so the shared element above has enough of the flight to read as travel.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Keep a morph honest about what it carries. An element whose destination fills its screen (`min-height: 100%` and friends) now actually grows during the flight instead of being pinned at full size by the clamp from the first frame, and any animation a consumer put INSIDE a morph — a `<Part>`, a spinner, a fade of their own — keeps its clock across the flight instead of replaying from the top the moment the element lands. The ghost no longer carries part markers, so no entrance runs a second time inside an afterimage.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Cut a morph's departing element at the flight's first frame instead of over a one-frame window. The element left behind rides its screen while the flight does not, so any frame that catches it still painting draws a second copy of it offset from the real one — which is what a dropped frame on desktop Safari was doing, leaving a sliver of the card beside the element on both push and pop.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Give the departure's own content a window to leave in. Content inside a morph with no counterpart on the other side — a caption, a body paragraph, a button that exists on one screen only — leaves on the ghost, and the ghost dissolved over 22% of the flight: three frames of a 0.4s morph, which is that content being cut rather than leaving. It read as a pop that was not the reverse of the push it followed. The window was chosen when the ghost painted everything, including the paired elements; it does not any more, since a paired descendant is already invisible in the copy with the real one morphing underneath it. The built-in presets now dissolve over 55% of the flight.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Read a flight's head kit from the routing rather than from the root's attribute. The engine announces which head kit a session plays by stamping an attribute on the document root, and it stamps it from the same commit a morph is staged in — after the morph, because React runs a descendant's layout effect first. So a morph read the previous flight's answer: right by luck from the second navigation on, and wrong on the first, which started the element 33ms ahead of the screen carrying it and then aligned every push after it. That is what made the mismatch intermittent. The head decision is now one exported function that the engine's routing and the morph runtime both call, so there is no ordering left to lose.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Keep a morph flying when its animation is rebuilt mid-flight. A CSS animation that is torn down and replaced reports an `animationend` with no elapsed time — same name, same keyframes, same duration — and landing on that put the shared element back in its screen before it had moved, so the morph looked skipped while the screen transition ran on. The landing now waits for an end that actually ran.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Carry every property the two ends of a morph paint differently, from a declared table instead of a branch per property. The arriving element is the destination's tree, so on the flight's first frame it already wears the destination's corner, surface colour, border and shadow — each one steps at the instant of the tap and then holds while only the box moves. That was being fixed one property at a time as each was spotted on glass, which is a list only ever as complete as the last thing someone noticed; `border-color`, `border-width`, `box-shadow` and `color` had exactly the same step waiting and nothing would have caught them. All of it now rides one paint animation, never the travel keyframe, so the travel stays on the compositor — and because the corner no longer has to be divided by a scale, percentages, per-corner and elliptical radii work too. The table now covers every property of the element two screens can set differently and CSS can interpolate — surface and its framing, ink, border, outline, shadow, filter and backdrop-filter, blend mode, inner gaps, object position and SVG paint — with `line-height` and `word-spacing` joining the type channels. What is left out is left out for a stated reason: `opacity` belongs to the transition, `background-image` is the element's identity, and `min-*`/`max-*` are lifted for the flight rather than carried.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Pair a morph even when the flip found nothing to snapshot. The departing side was measured only from the store's own subscriber at the moment of the flip, so a binding that re-renders synchronously inside that notification, or a screen whose morphs mount after it, left the arrival with no partner — and a pair that does not happen looks exactly like a screen transition with no morph in it. The arrival now measures its partner itself when the sweep missed it, in the same rest space the sweep would have recorded. Adds `flemo:morph=on`, an opt-in trace of every flight decision on `globalThis.flemoMorphTrace`, because a morph that declines is otherwise silent by design.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Pair a morph only with the other side of the flight that is actually running. A `layoutId` is a name, not an address, and the same one legitimately sits on several screens of a stack — so pairing by name alone let a navigation between two screens reach down and grab an element belonging to neither. Two failures came out of that: a morph running on a navigation with no shared element in it, and an element staged at a rect measured on a screen that no longer exists — appearing full size in the middle of nowhere before its own screen had arrived, on the second walk through a stack. A partner must now be in the document and on a screen that is transitioning right now, on the side the arrival is not; snapshots of unmounted elements are dropped at the flip.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Run a morph's travel on the arriving screen's own curve when that screen's transition moves it. A morph's destination is a place ON the arriving screen, so a screen that slides or rises in carries that place along with it — the element is chasing a moving target, and chasing it on a second clock leaves the two disagreeing in both position and size. Measured on a cupertino pop, at the same point in the flight: on two clocks the element fell from 75px behind its place to 118px behind before turning round, and was still 160px too wide; on one clock it was 61px behind and closing, 149px too wide and closing — monotone on both axes and closer on both at every sample. A screen that arrives in place carries nothing, and a morph there keeps its own curve. Whether the screen moves is read from the transition's definition rather than from the element, because at the moment a flight is staged the arriving screen is parked at its destination with no transform on it yet.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Hold a flying element's place with a copy of it rather than with a box the size of it. The placeholder was an empty block given the element's measured width, height and margins — right to the pixel, and still wrong: WebKit-measured, a card inside an `inline-block` button left its `<li>` 6.31px taller for the entire flight, because an empty block gives the button no baseline to synthesise from and the line box then adds the strut's descender. Everything below the element sat 7px low until the landing snapped it back, which is a layout shift with a morph's exact timing. Chromium adds that space at rest too, so it never moved there and the bug was invisible on it. A stand-in copy has the same box, the same margins and the same baseline, so the layout cannot tell it apart — and the three inline overrides that used to approximate them are gone.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Morph type now re-typesets instead of merely re-sizing: weight and letter-spacing interpolate alongside font-size, so a 14px/600 list label growing into a 24px/800 heading passes through every face between rather than wearing the destination's from the first frame. And the departure's cut now lasts as long as the flight rather than as long as the travel — under a screen transition with no motion of its own, the element that had just flown away used to reappear at full size for the frames between the landing and the screen's own end. A cut is also superseded when a new flight picks up either of its two elements, so a pop that interrupts a push cannot bring the previous flight's hidden state home with it.

- [`2f1e394`](https://github.com/kimjh96/flemo/commit/2f1e394a9c95de44e11f9bad49340b95acdbc4a3) Start a nested morph from the pair's measured from-pose. A nested element rides its container's box, and riding alone rendered it at the arrival's own place inside the travelling box from the first frame, so any difference between the two ends' local arrangement (an inset kept on the element at one end and on an ancestor at the other, a different gap under the artwork) was a lurch at the tap: measured at 20px sideways on the playground's caption and 16px on the demo it replaced. The nested flight now carries a translate from the measured from-delta to identity on its own curve, exact at both ends. Also stamp inherited line-height on a hoisted element as the factor rather than the used length, so descendants that set only a font size keep their own leading instead of inheriting the container's resolved pixels mid-flight.

- [`8e5e401`](https://github.com/kimjh96/flemo/commit/8e5e40144264e39a6cf804b87b1b8194a7b60be6) End a nested morph's size interpolation on the element's rest size, measured at registration, rather than on the staged measurement. Staged is taken inside a container still at its from-box, and when the container's width interpolates the child is laid out slightly small there: the flight froze short of the page and snapped the difference at the landing, and the same error ran the pop. A binding registers child-first, so registration sees the natural arrival layout, and the flight now lands exactly on it in both directions.

- [`52ff075`](https://github.com/kimjh96/flemo/commit/52ff0759973b5f1ee87079a3a0fd796bf7952827) Carry a nested morph's own size, the other half of the from-pose correction. Riding sizes the child through the container's width interpolation, and that works only when the width actually interpolates: a container that starts at destination width, such as a full-width list row becoming a page, lays the child out full-size on the first frame, and a 48px thumbnail spread into a full-width strip at the tap instead of growing. The nested flight now interpolates the element's own width and height from the measured from-size to its size in the staged container, which is exact at both ends and silent for containers whose width does the carrying.

- [`27425a9`](https://github.com/kimjh96/flemo/commit/27425a96b47042ac665008c1ce89ad47f031497e) Emit a nested morph's width and height as separate keyframe declarations. The size channel's two declarations were joined with an escaped newline that reached the stylesheet as a literal backslash-n, which silently voided the height: the width animated alone, so a pop shrank the artwork as a squashed rectangle from a shrunken start and its corner reads followed the deformation. The rule's tests now also reject any literal backslash, since substring assertions passed right over the malformed line.

- [`d006b5f`](https://github.com/kimjh96/flemo/commit/d006b5f729c9178acc2f633cd8fb521376f7e797) Stop animating the box size of a nested re-typesetting pair. Type moves by font-size and its box belongs to layout; forcing the captured block width onto a flex row reflowed the siblings every frame.

- [`2741f85`](https://github.com/kimjh96/flemo/commit/2741f8515f2f0e4e4288f2d7b07ea76a5b13d183) Keep a screen transition running when its animation is rebuilt mid-flight. A CSS animation that is torn down and replaced reports an `animationend` with no elapsed time, carrying the same name, keyframes and duration as a real one, and the engine resolved the navigation on it: the store move committed and the screen flipped to COMPLETED while the motion was still at its from-pose, so what reached the glass was a cut where a transition was authored. The flight now waits for an end that actually ran, and a variant with no motion of its own still lands immediately.

- [`57bbab4`](https://github.com/kimjh96/flemo/commit/57bbab432c4cfa76c04c7a5f0546c2b6cc6a6204) Hand a committed swipe's layer promotion back. The gesture promoted the screens it dragged and only released them when it was cancelled, so every swipe-back left `will-change: transform` on the screen it revealed and never took it off, because the engine's own release runs under a different owner. That kept the screen a containing block at rest, which trapped a consumer's `position: fixed` overlay inside the screen box and under the shared bars.

## 1.30.0

### Minor Changes

- [`5b83d3b`](https://github.com/kimjh96/flemo/commit/5b83d3b46ed268ee07e834e7d7819a4e577a1111) Declare the `data-flemo-*` DOM contract in one place. `@flemo/core` now exports the
  whole protocol — every attribute name, the animation hold's values, and selector
  helpers — instead of spreading ~27 string literals across four packages where a
  rename broke the others silently. Consumers styling or querying flemo's attributes
  can import the names rather than hard-code them.

  The contract is now enforced from both ends: core fails its own suite on any raw
  `data-flemo-*` literal, the React binding fails if it renders an attribute core does
  not declare, and the devtools recorder's deliberately-separate copy is pinned against
  core's table.

- [`7b7fdd3`](https://github.com/kimjh96/flemo/commit/7b7fdd3595c8697967b9db56f6aea1aa942b149f) Export the `flemo:*` diagnostic-flag registry from `@flemo/core` as data — `DIAGNOSTIC_FLAGS` and `RETIRED_DIAGNOSTIC_FLAGS` declare every storage key the library reads, its default, and the keys it has stopped reading. It replaces a comment table that had drifted from the code, and it is now held to the readers in both directions: a key read without a row, or a row nothing reads, fails the build.

  `@flemo/devtools` mirrors that registry field for field instead of hand-copying it (its runtime stays dependency-free), so reports name every live flag, state the default an override is departing from, and stop listing the panel's own storage key as unknown. `FlagDescriptor` gains `values` and `fallback`, and its `description` field is now `effect`.

- [`d250cc5`](https://github.com/kimjh96/flemo/commit/d250cc5bf3dbc9b8699f6387c219311bd23dca28) Resolve every per-browser decision in one place. `@flemo/core` now exports
  `resolvePlatformProfile()`, which returns the atomic release flip, the render-settle
  gate, the deferred release commit, the park-over hold, the rest promotion and the
  image-decode offload as named fields. `@flemo/react` asks for the profile and renders
  the answer instead of combining engine probes and diagnostic flags itself, so a
  binding for another framework has no policy to re-implement.

  Platform detection modules (`engineProbes`, `governedCompiled`, `steadySixtyCadence`,
  `displayCadence`) moved out of the engine directory to sit beside the profile. The
  raw flag readers are no longer part of core's public surface — ask the profile.

- [`f32c2cc`](https://github.com/kimjh96/flemo/commit/f32c2cc7022dd8d32382420c3a26054546cfaf48) Retire the rAF motion player. Every browser flemo supports already ran the compiled
  compositor tier — Blink, desktop Safari and touch WebKit were each routed there
  unconditionally — so the second driver, its landing pixel-snap, its kind classifier, the
  driver policy and eight diagnostic flags (`flemo:motion-driver`, `-force`,
  `landing-snap`, `handoff`, `handoffms`, `apply`, `snap`, `snapband`) are gone. Authored
  `driver: "player"` pins are no longer accepted; `driver: "native"` keeps its meaning
  (opt into clock surgery for that transition). `@flemo/core` drops 2.8 KB gzipped.

  Devtools reports lose the `driverPolicy` section and instead list retired `flemo:*` keys
  still persisted on a device, marked as inert, so residue is ruled out rather than chased.

- [`fbd937c`](https://github.com/kimjh96/flemo/commit/fbd937c2fe15b451c6b216e524379d85a4cf5849) Add `startFlemoRuntime()` — flemo's ambient machinery behind one call. The GPU
  pipeline prewarm, the image-decode offload and the interaction compositor warm-up
  are what an app sits in so the first navigation is not the one that pays for them,
  and none of it is framework-specific. A binding starts the runtime per Router mount
  and releases on unmount; repeat calls share one runtime.

  `@flemo/react` loses 58 lines and its last document event wiring. Nested Routers now
  share one listener set instead of installing their own.

### Patch Changes

- [`8cb6366`](https://github.com/kimjh96/flemo/commit/8cb636674b2634510253d2265569904c6da05e69) Track the engine's architecture map. `packages/core/docs/motion-engine.md` describes the
  compiled-tier design as it stands, and a test holds its module inventory to the code —
  every module named must exist, every module under `core/engine/`, `platform/` and `dom/`
  must be named. The previous version of that map sat untracked for a release cycle and
  ended up describing a motion driver and two modules that had been deleted.

  Source comments no longer cite documents that are not in the repository.

- [`d70ced3`](https://github.com/kimjh96/flemo/commit/d70ced37926a359b192b5f5b3b8f9151f340ec5b) Split the transition engine into named modules. `createTransitionEngine` was a
  2,138-line file holding participant discovery, compositor-layer leases, cancel-resume
  wiring, the display probe and the per-flight routing decision alongside the lifecycle
  it exists for. Those are now five modules with their own tests; the engine keeps the
  navigation-task lifecycle, the holds and the resolution. No behavior change.

- [`d15b18a`](https://github.com/kimjh96/flemo/commit/d15b18ad91687a7e564f0f8be54e55554b181adf) Add `flemo:governed`, an override for the governed head kit on touch Blink. The kit is armed by a browser-age probe, so a modern-but-weak phone — a 2022 foldable on a current Chrome — falls straight through it with no way to try it. The key arms or disarms it per session so a device can be measured instead of argued about.

- [`05e4d40`](https://github.com/kimjh96/flemo/commit/05e4d4072d4cd5555ef63cfde8dd0e8985426720) Move the per-screen holds — the compositor warm-up, the in-flight arrival armor and the
  warm side's image hold — into their own module, and pin the engine's "never a double
  resolution" invariant with a test rather than by splitting the six resolution paths
  apart. No behavior change.

- [`28fb128`](https://github.com/kimjh96/flemo/commit/28fb1280661f1d886f898310c5b86318e2772d36) Stop treating a missing UA-CH brands list as proof of an old browser. `navigator.userAgentData` is exposed only in a secure context, so a current Chrome looks identical to a 2019 one the moment a page is served over plain HTTP — and a Galaxy Z Flip 4 was taking the legacy Android Blink profile (the image decode offloader, the governed head kit) on a LAN test server. The browser version is now read positively from the user-agent string when the brands list is unavailable.

- [`3ddef71`](https://github.com/kimjh96/flemo/commit/3ddef71eed6bd53b2624d190668390295019c9ac) Let the image decide whether the decode offloader runs, not the browser. It was armed by a browser-age probe, and the cost it removes is not created by the browser: a 48px avatar holding a 37-megapixel original is expensive to decode wherever it lands. The offloader already makes the decision that matters — per image, from the source's own bytes — and leaves a well-sized one exactly as authored.

- [`a4c1a74`](https://github.com/kimjh96/flemo/commit/a4c1a744f343b86352cc74e1616144f1b35109ad) Hand the navigation queue over on a frame boundary. A queued navigation woke synchronously with the previous flight's terminal flip, so one binding commit unmounted the finished flight's screen and stamped the queued flight's opening together — a single frame carrying two flights' worth of style, layout and paint. A fast double back dropped a frame at exactly that seam.

- [`ebf7d78`](https://github.com/kimjh96/flemo/commit/ebf7d786bd8a8154d9322796f2bec413fcf9131e) Make a swipe release leave at the speed the screen already had. The settle ran the transition's authored curve, which is front-loaded because it starts from rest — so a committing swipe departed at 1.7x the finger's speed on a hard flick and 8.4x on a gentle drag, and a cancel departed at 2.25x from a screen the finger had brought to a stop. The release now re-aims that curve's opening onto the gesture and derives its length from a decelerating landing, in both directions.

- [`e67146a`](https://github.com/kimjh96/flemo/commit/e67146a4c6857d90de88c372732a92d005e6d305) Give a swipe release the time the authored curve itself spends on the stretch that is left. The length came from `authored duration x fraction remaining`, which is the time a constant-rate motion would need — and a front-loaded transition curve is slowest exactly where a release lands. Released with 30% of the screen left, cupertino's button-driven pop covers that stretch in 0.550s where the release took 0.210s, and the gap widens the closer to the end the finger let go.

- [`a8ed9cd`](https://github.com/kimjh96/flemo/commit/a8ed9cd4aa3298eb6e3e6fc38930de3056f3ebc3) Measure a swipe's release velocity over a short window instead of the last pointermove pair. A release's length divides by that number, so one unlucky pair — browsers coalesce pointer events and batch them behind a busy frame — could report several times the finger's real speed and collapse the landing onto its floor. With 30% of the screen left, an honest 600 px/s asks for a 0.21s settle where a spurious 2000 px/s gets 0.12s.

- [`9f1205c`](https://github.com/kimjh96/flemo/commit/9f1205c42d37f354828c17463862dd0838d0c0ba) Stop a swipe gesture from surviving the pointer that started it. While a drag is armed the screen suppresses native touch scrolling, and that flag could only be cleared by a pointerup carrying the id that armed it — so when the browser never delivered one (Safari drops the remaining pointer events when the element holding capture is removed or hidden), the screen stopped scrolling for good, and the next press could not recover it either. A gesture now also ends on `lostpointercapture`, on the next primary press, and when the screen unmounts or freezes underneath it.

## 1.29.0

### Minor Changes

- [`47332c9`](https://github.com/kimjh96/flemo/commit/47332c92c2b530e4b1fc2426b62dcfb5490b5f69) Retire the iOS Low Power Mode cadence detection. Its treatment — the compiled tier with the governed head — became the default for every touch-WebKit flight, which left the detection gating nothing: a rAF loop running from module load to the end of the session, six more frames per routed flight and a `sessionStorage` seed, all feeding a flag no code read. `lowPowerCadenceActive` is gone from the public surface; `governedCompiledActive` (the predicate the routing actually asks for) stays. The head gate and its keyframes are renamed to say what they mean — `data-flemo-lpm` is now `data-flemo-governed`, and the `-lpm` animation suffix is `-gov`.

### Patch Changes

- [`b89635e`](https://github.com/kimjh96/flemo/commit/b89635eb83ca3b685b61c0c03fdd85294e82f684) Fix a cancelled swipe snapping back. The release clock sized every settle from the finger's momentum and the distance left, but a cancel travels _against_ the finger and only ever from below the transition's commit threshold — so both terms collapsed and every cancel ran the 0.12s floor, snapping an authored curve. A settle that reverses the gesture now ignores momentum it cannot borrow and lands no faster than 0.28s, still capped by the transition's own duration.

## 1.28.1

### Patch Changes

- [`ab29846`](https://github.com/kimjh96/flemo/commit/ab29846347076b8c102e8acca6a95b859174a72c) Make a swipe-back as cheap per frame as a transition is. The gesture promoted its riding bars only, so both full-screen scopes and the dim were repainted from scratch on every frame the finger moved, and it ran the whole follow — both screens, the bars, the dim and every `<Part>` — on every pointer move rather than once per frame. Both now match what a flight already does; the release still settles from the finger's last real position.

- [`a97af55`](https://github.com/kimjh96/flemo/commit/a97af5544dc6cb426a9daf8868af5cd7b11b2903) Stop a back-swipe from catching once at its start. The screen a swipe reveals is normally frozen, and starting the gesture is what wakes it — a commit over that whole screen that used to land on the drag's first frames. The motion now waits for the reveal to be painted and then resumes from where the finger is, so the opening is a frame or two later and nothing stutters after it. A gesture with nothing to wake is unaffected.

- [`c987660`](https://github.com/kimjh96/flemo/commit/c987660617927cdcfbc733e5b8cf4fe67bd707fd) Give every swipe release the length its gesture asks for. A release ran whatever duration its handler named — one number for six pixels left or three hundred — so the same navigation landed in a different time depending on whether it was swiped or tapped. The swipe controller now scales that authored duration by what is left to travel and how fast the finger was going, keeping it as the ceiling, at the one place every release write passes through: the transition's hooks, its decorator's, and its parts'. Transitions authored by consumers get it without changing a line.

- [`e093b50`](https://github.com/kimjh96/flemo/commit/e093b50d19e7c3e526f44c2a6b29f9ceffa7bdfc) Settle a swipe release on the compositor. The motion after a gesture lets go was driven by a main-thread clock that stepped every settle frame — a trade inherited from the retired player, and the wrong one where the main thread is the scarce resource: on iOS in Low Power Mode the release stuttered along with the drag. It is now an ordinary CSS transition carrying the same authored duration and easing, on every engine, and the scrub clock is gone.

## 1.28.0

### Minor Changes

- [`db0985b`](https://github.com/kimjh96/flemo/commit/db0985b6d5e81bf5a2cd0e24bba97b0176cd2844) Stop a screen scope from staying a compositor layer at rest. A promotion is also a stacking context, so a scope that kept one outlived its flight and silently outranked anything a consumer rendered inside the screen — an open bottom sheet came up under the shared tab bar and no z-index could answer it. Flight-time promotion is unchanged; it belongs to the engine, which demotes it a settle past the landing. `flemo:preraster=on` re-arms the rest promotion and `flemo:layers=resident` the resident layers, both now opt-in.

### Patch Changes

- [`d30a03f`](https://github.com/kimjh96/flemo/commit/d30a03fb860a3850c2925c9f67dad5615a7d50ac) Swipe back on a screen that hosts a nested `<Router>` and the screen's own dim now moves with the drag. The gesture resolved the previous screen's decorator, shared bars and parts with a descendant query, which finds the INNER router's elements first — so the inner dim faded while the screen's own stayed fully dark for the whole drag.

## 1.27.1

### Patch Changes

- [`034a295`](https://github.com/kimjh96/flemo/commit/034a295aae17d2cb2a872b07666d6d570cec6753) Keep a screen's shared bottom bar when it comes back. A screen covered while a software keyboard was open lost its viewport subscription to the freeze and never saw the keyboard close, so on the way back its shared bottom bar and system navigation bar stayed hidden and swipe-back stayed refused. The viewport observer now measures once for the whole app and hands the current measurement to any screen that (re)subscribes.

## 1.27.0

### Minor Changes

- [`fb4bb71`](https://github.com/kimjh96/flemo/commit/fb4bb71074f697435acfe8609b4073e2e2c4adc0) Key the two desktop defaults that are not about refresh rate on the desktop
  itself. The screen-scope layer promotion and `ScreenFreeze`'s hide debounce now
  read a new `isDesktopBlink` predicate instead of the learned steady-60 verdict:
  one is about how Blink treats an occluded layer, the other trades memory for
  raster, and neither reads the display. Desktop Chrome sessions get both from
  their first flight instead of after a two-flight cadence measurement, and a
  120Hz or 1x desktop is no longer excluded from defaults that never depended on
  its panel.

- [`e89b3e7`](https://github.com/kimjh96/flemo/commit/e89b3e776722ea972250c5fe4af91083ba33a643) Land the arrival hold at rest on every tier, and promote the screen layer on
  desktop Safari too. The hold's release commit no longer lands in the motion's
  sub-pixel tail — the placement that measured as a skipped-frame-class gap on
  essentially every push — so content becomes visible just after the transition
  instead of just before it ends. The layer promotion, meanwhile, was reaching
  touch WebKit and desktop Chrome but not desktop Safari, with nothing in its
  reasoning to justify the gap.

### Patch Changes

- [`cbb258d`](https://github.com/kimjh96/flemo/commit/cbb258da2b94456d3c7d31db6ab1bbada0ceb764) Keep channels that never interpolate out of the compiled keyframes. A property
  authored with the same value on both ends of a variant — the overlay
  decorator's dim colour, a transition's constant edge shadow — is now applied by
  the variant's own rule instead, so the keyframes name only what actually
  animates. Engines drop a whole animation to the main thread when a keyframe
  mentions a property they cannot composite, which showed up on Android as a dim
  that lagged and stuttered while the screens slid smoothly.

- [`c0232a9`](https://github.com/kimjh96/flemo/commit/c0232a940c614b6442b63b8abf61ba8d86a94adf) Retire the image reveal hold's automatic default. It shipped on for the
  steady-60 desktop profile; a desktop A/B rotating it per push/pop pair — on a
  session with images genuinely completing mid-flight — was judged
  indistinguishable, and a touch round the same week measured it as a net loss
  (fewer hitches in the flight, more at the landing, because parking the paint
  parks the decode with it). `flemo:imghold=on` still arms it for a consumer whose
  own measurement asks for it.

- [`b786a0b`](https://github.com/kimjh96/flemo/commit/b786a0b9a5fa81b19ab38b6f77e0d7149eca5d81) Stop building the steady-60 desktop verdict on touch devices. The verdict is a
  desktop profile — a touch session can never read it — but every Blink flight
  was still feeding it, which cost a synchronous `sessionStorage` write per
  flight on exactly the phones that can least afford one. The display probe that
  feeds it still runs there: its other output (the learned frame interval) does
  reach touch Blink.

## 1.26.0

### Minor Changes

- [`6b1bb93`](https://github.com/kimjh96/flemo/commit/6b1bb93383221c29ba0d630123ca60a7b8f16d30) Hold the first frames of a transition on desktop macOS Safari until the browser
  can actually present them. A compiled clock there starts at the release update's
  style resolution but reaches the glass a pipeline later, so the curve used to be
  entered partway and the motion read as too fast. The screen now waits out that
  latency at its authored start pose, the way touch WebKit already does.
  `flemo:deskhead=off` restores the previous behavior.

- [`d6dab7f`](https://github.com/kimjh96/flemo/commit/d6dab7f398024dd3f9cae885aba9dfa73b48dda6) Release the anim-hold straight onto the DOM on desktop macOS Safari, the way
  touch WebKit already does. That session runs a compiled animation whose clock
  WebKit presents from the main thread, so letting React's render and commit work
  sit between the clock's start and the released attribute cost it the front of
  every transition. `flemo:deskflip=off` restores the previous path.

- [`9685d02`](https://github.com/kimjh96/flemo/commit/9685d020fea2e6f87ee7893a6b3d616cd8cc26bd) Steady the opening and the landing of a transition on iOS Safari. Three changes
  ship on by default there, each measured on a device: the hold's release no
  longer shares its frame with React's reconcile, the held head carries a hair of
  motion so the compositor is already driving the animation when the real motion
  starts, and the entering screen's layer is painted during the hold and kept
  resident at rest instead of being torn down as the flight lands. Sessions can
  opt any of them out with `flemo:relcommit=sync`, `flemo:creep=off` and
  `flemo:layers=off`.

### Patch Changes

- [`9d706dc`](https://github.com/kimjh96/flemo/commit/9d706dcda42aacc4d15262dd76fbe7821a52d541) Stop reading diagnostic toggles from the URL. `?flemo-layers=` and
  `?flemo-freeze=` wrote a session key on any visit, so a link was enough to
  change how the library behaved for the rest of that tab. Both toggles keep
  working through their `flemo:layers` / `flemo:freeze` session keys.

## 1.25.1

### Patch Changes

- [`445e116`](https://github.com/kimjh96/flemo/commit/445e1163cf3b53d31b3b3cd0e19856bcd237aa9e) Arm the render-settle gate by default on desktop macOS Safari. That session runs
  the compiled tier, which WebKit presents from the main thread, so a heavy entering
  screen's mount used to age the animation's clock while nothing was on glass — the
  transition appeared to start already two-thirds finished and then replay from the
  top. The gate now holds the release until the mount settles, so the opening plays
  in full.

## 1.25.0

### Minor Changes

- [`c2aa749`](https://github.com/kimjh96/flemo/commit/c2aa749a4064ebe68f22bc2ad4e7f8f88c0d41bb) Fix a React hydration mismatch on server-rendered screens: the scope's
  `will-change: transform` promotion is derived from browser-only state
  (`flemo:preraster`, the steady-60 desktop profile), so it is now deferred past
  hydration instead of being evaluated in the hydration render — the server HTML
  and the first client render always agree, and the promotion still lands before
  any transition can start. Core exports `readLayerPromotionFlag`, the single
  predicate both halves of that decision now read.

## 1.24.0

### Minor Changes

- [`30c2a54`](https://github.com/kimjh96/flemo/commit/30c2a5428e3561aa0d43295df852031c02975e39) Add optional shared top and bottom bar IDs so only semantically matching bars hand over in place. Reuse matching partner measurements and synchronously reserve newly measured bar heights before paint, while retaining the legacy position-only behavior when IDs are omitted.

- [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541) Add an in-flight display-cadence probe that verifies steady-60Hz desktop sessions. The first flights of a session measure the panel while a compositor animation is live (the only moment an adaptive 120Hz panel shows its true rate); two verified ~60Hz flights mark the session steady-60, and a single high-refresh reading latches it off permanently. Desktop Blink routing itself stays on the compiled compositor tier (the settled verdict of on-device judging), and the verdict instead arms desktop-profile defaults: the render-settle gate, the unpainted-only image hold, and the compositor warm-up. The settle gate's give-up path now also rides two consecutive fast frames before releasing, so a pop's returning screen, whose unfreeze re-uses its DOM and never trips the mount-commit detector, has its style/layout block absorbed into the hold instead of stuttering the flight's opening. Behavior at 1x density, on high-refresh panels, and on touch devices is unchanged.

- [`b495c99`](https://github.com/kimjh96/flemo/commit/b495c99651e2eb73f720d2f802525b538a782c95) Scope the image-decode offloader to legacy Android Blink instead of running it on every device. A touch Chromium that ships no UA-CH brands (device-confirmed Galaxy Note 9 Samsung Internet) is confidently pre-2021, GPU-starved hardware whose oversized-image decode stalls the transition opening on re-entry; the offloader now auto-engages there and downscales only its genuinely oversized `<img>` sources. Modern devices (which ship UA-CH brands) and iOS are excluded, so a flagship is never touched, and `flemo:imgoffload` still overrides both ways (`on` forces it anywhere, `off` opts a legacy device out). Exposes `isLegacyAndroidBlink` from `@flemo/core`.

- [`945eaba`](https://github.com/kimjh96/flemo/commit/945eabace0200a7693271e9433e28da62f2e848a) Fix the pop-convergence round: post-landing layer demotions now wait out any
  in-flight navigation (the intermittent mid-pop stall), the player's
  perceptual cut lands its final pixel on the cut frame instead of the
  COMPLETED flip, and a navigation force-concludes swipe settles on its
  participants — a tap grazing the swipe-back edge no longer fights the pop it
  triggered. Desktop WebKit and desktop Blink now ride the compositor-driven
  compiled tier deterministically, with the landing governor expressed as an
  easing reshape. The image decode offloader holds re-entry reveals to the
  flight's rest, and the playground's baked gradient is scoped to Blink (the
  swap itself was Safari's first-entry blink). On iOS, Low Power Mode is now
  detected (a regular ~33ms rAF cluster, isolated from the player's learned
  interval, persisted per session) and single slide navigations route to the
  compositor-driven compiled tier with the birth anchor and stall watcher
  armed — rAF is capped at ~30Hz under LPM while the compositor keeps the
  panel rate, so transitions stay smooth instead of half-density.

- [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541) Fix the live-judged desktop Chrome jank sources found in the 2026-08-18 campaign: hold the warm side's still-loading images too (a leaving list's lazy avatars were decoding onto the sliding layer, one skipped present per decode), make image holds single-owner (an overlapping hold captured another hold's display:none as the "original" and blanked already-loaded avatars), exempt held images' style channel from the arrival hold's in-place freeze (it was undoing the hold mid-flight and resurrecting the hide at rest), widen the GPU pipeline prewarm scene to the draw variants real screens use (image texture under a circular clip, gradient, CJK text, hairline border, shadow; cold-profile first flights carried 120-150ms of in-flight pipeline compiles), and keep a 2KB always-on 60fps video surface on steady-60 desktop sessions so the display pipeline holds a steady compositing cadence between and during flights. Desktop routing is settled on the compiled tier; the steady-60 verdict now gates desktop-profile defaults only.

- [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9) Route Blink to the compiled tier everywhere. Desktop Blink already did; touch Blink defaulted to the rAF player and reached the compiled tier only by demotion — two stalled flights, persisted per origin, and re-probed once per session, so the first flight after every page load ran the player even on a device whose ledger already said "css". A weak phone's behavior therefore depended on which origin it had visited and how recently it reloaded. Blink is now one rule from the first flight, and demotion is off everywhere since its only purpose was reaching a tier Blink now always uses. WebKit is unchanged: there the compiled tier swallows its opening and the player stays device-verified. The `flemo:motion-driver-force=raf` pin still pierces.

### Patch Changes

- [`9b16d8f`](https://github.com/kimjh96/flemo/commit/9b16d8fcd5b267b0e8865001c8db505be56814cf) Fix the COMPLETED cleanup leaving a stale pose on the landed screen: when another inline lease survived the flip (the governed easing stamp), the entering screen could stay parked at its from-pose — on a raf-pinned desktop session this presented as a fully blank viewport after a push→pop→push re-entry. The landed scope's transform/opacity are now stripped explicitly at COMPLETED, and the raf force pin can pierce the desktop compiled gate again for diagnostics (default desktop routing is unchanged).

- [`cec6ab6`](https://github.com/kimjh96/flemo/commit/cec6ab66d6334fe8203ea304fe496ff6849fa559) Remove dead diagnostic instrumentation (the write-only `window.__flemoRoute`/`__flemoOpenings`/`__flemoSeam`/`__flemoHandoffs`/`__flemoParked` globals and the unused `flemo:compiled` and `flemo:native` toggles) and consolidate the surviving `flemo:*` debug flags into one documented registry (`diagnosticFlags.ts`). No behavior change — every shipped default, storage key, and per-page-load caching contract is preserved, and `window.__flemoPlayerGaps` keeps working.

- [`0473551`](https://github.com/kimjh96/flemo/commit/0473551b5911d203ae7984ba53623baa6268396b) Stop the `driver=raf` force-pin from routing desktop Blink onto the rAF player. The player has never driven a non-touch flight; device-reproduced, after a re-entry (push→pop→push) it leaves the entering screen pinned at its from-pose (`translateX(100%)`) — the birth/play never fires — so the screen sits entirely off-screen and the viewport goes blank. Desktop Blink stays on the compiled compositor tier, which completes cleanly.

- [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745) Add an opt-in image reveal hold (`flemo:imghold=on`) — the `<img>` analog of the response hold. During a flight, an entering screen's still-loading images are held invisible and revealed in one batch at rest, so an image that completes over the network mid-slide can't re-raster the sliding layer and starve the animation. Image decoding still proceeds during the hold, so the reveal is a cheap composite in the quiet window rather than a mid-flight raster. Off by default while it's verified on-device.

- [`20744c0`](https://github.com/kimjh96/flemo/commit/20744c0f2ed1bcfd8d50a5c4b6c9fb52bc7d9226) Hold `<Part>` elements that live outside any screen for the flight's hold window. The compiled hold rule only pauses held elements and their descendants, so a Part in persistent chrome beside a `<Slot>` (or in a portal) kept animating while every screen was parked, then led the flight by the entire hold. The engine now stamps the hold on those parts directly, scoped by the owning Router and owned by the active side so two screens cannot fight over one persistent element.

- [`88c5cff`](https://github.com/kimjh96/flemo/commit/88c5cff30f3edd580b4a52513e287aa1c082882f) Make the `driver=raf` force-pin actually drive the player on desktop Blink. The desktop/high-refresh gate (`maxTouchPoints === 0 || …`) fired before the pin was honored, so a pinned session silently stayed on the compiled tier there — leaving the player+per-frame-snap path (the only tier that can quantize a HiDPI transform to device pixels every frame and kill the sub-pixel convergence shimmer) unreachable on desktop even when explicitly pinned. The pin now bypasses this gate, same as it already bypasses the native-kind choice.

- [`14923eb`](https://github.com/kimjh96/flemo/commit/14923eb8d7f6c9c3574d8c95db606ff190b2ca54) Raise the player's learned frame-interval floor from 240Hz to 600Hz so its cadence estimate can track the fastest panels now shipping (consumer esports monitors reach ~540-600Hz). The old floor clamped a genuine high-refresh desktop down to 240Hz, leaving the pacing heuristics (jitter thresholds, pixel-snap budgets) calibrated for a slower display than the panel really is. The estimate is a median, so widening the floor doesn't reopen the jitter-fakes-a-fast-panel hole the floor guards against.

- [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745) Fix rapid navigation swallowing the transition on the compiled tier, and steady Chrome's ProMotion frame pacing during compiled flights.

  A stale resolver (a finished flight's animationend/cancel firing a frame into the next one) could resolve the CURRENT task instead of its own, flipping `data-flemo-status` to COMPLETED at the exact frame the new flight released its hold — un-matching the running `@keyframes` rule and cancelling the slide mid-opening, so a fast Next/Back burst committed the navigation but showed no motion. Each flight now resolves only its own captured task, so a late resolver can never cut a newer flight.

  Separately, a compositor-driven flight left the main thread idle, and Chrome then paced its macOS ProMotion presentation unevenly (dropped/duplicated frames mid-slide, read as convergence trembling). A lightweight frame-pacing keepalive now holds a live frame source across compiled Blink flights so the panel stays at its full refresh rate.

- [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9) Remove the stall-demotion machinery from the driver policy. It moved a chronically-starved Blink device onto the compiled tier, and Blink now starts there, so it had nothing left to decide: the per-run gap accounting, strike counting, the irreversible in-session demotion and the persisted `flemo:motion-driver` ledger with its probation probe are gone. The force pin is now the only input to driver selection. Player frame gaps are still reported to the registry's diagnostic hook.

- [`2be1e05`](https://github.com/kimjh96/flemo/commit/2be1e05a6d18883830edeaffbe5db7d724ebb204) Retire the LPM release-latency ledger. The probe armed on every low-power-supervised flight and persisted a session-worst value to `flemo:lat`, but no production code ever read it — the birth hold is sized from a static table, so the "adaptive" hold was always the static guess. Removing it drops an observer per flight on the weakest devices in the matrix and one more persisted ledger that can go stale between builds.

- [`6d6dae8`](https://github.com/kimjh96/flemo/commit/6d6dae8f98b159d3faa5b0b57a637288fffc6c53) Keep transition-adjacent scrolling responsive and reject cross-axis touch jitter before page-wide swipe-back can claim or cancel into an unintended pop.

  During push and replace transitions, Flemo suppresses `click` activation for React handlers and native click listeners below the React root. Listeners above the root, plus lower-level pointer and mouse events, remain observable so the browser can preserve native scroll targeting across the transition.

- [`6d3cc23`](https://github.com/kimjh96/flemo/commit/6d3cc238755a1a7d2d25edbf9113ea7c27fc571e) Default the render-settle entry gate ON for touch Blink. The pop-convergence round proved on a Note 9 that a heavy mount commit stalls even the compositor's initial layerization — gating the release past that task measurably helped — and widened the gate's arming to every engine on that evidence, but the flag that enables it stayed WebKit-only, so Android kept running ungated. The gate stays adaptive (no qualifying mount commit inside the first wait releases with no felt delay), and `flemo:settle-gate=off` still opts out.

- [`bfd077a`](https://github.com/kimjh96/flemo/commit/bfd077a0b67181da88f73d46ccadcff73b7ff65d) Export `TaskManager` as the correctly-spelled alias of the historical `TaskManger` export (which remains for compatibility).

## 1.23.0

### Minor Changes

- [`490b0e4`](https://github.com/kimjh96/flemo/commit/490b0e420429b828011c7092c549f52258beae80) Motion driver overhaul hardening: device-verified fixes across five external review rounds plus two device-measured features.

  - Response hold parks every fetch method (reveal queries arrive as POST RPCs and HEAD counts too), never streams, with the self-release backstop bound to the whole choreography's span.
  - Owner-scoped, composable holds: layer settle holds refcount per-instance tokens and compose requirements as a union over the element's own inline values; inline writes and settle execution are writer-scoped leases; the owner-less force form remains the flight-over authority.
  - Blink detection via the UA-CH Chromium brand (WebKit's userAgentData no longer misreads Safari); stall strikes judged at each run's final measured cadence, so a genuinely slow display never demotes the player.
  - Player correctness: per-track writer tokens, sustained slow-cadence clock adoption with next-flight seeding, authored transform order preserved (non-canonical or padding-incompatible motions fall to the scrub tier), and the navigation resolves on the player's own clock once every track finishes.
  - Whole-choreography completion on every path (gate, floor, perceptual cut, early landing, screens-motionless case), with participants scoped to one Router's flight via explicit `data-flemo-router` markers stamped by the React binding on screens, shared bars, and parts.
  - Async image decode for flight participants: `decoding="async"` stamped on a transitional screen's images (and arrival-held content just before reveal) unless the consumer authored one — a device-measured 37MP portrait no longer freezes mid-flight.
  - Platform-density snap default: WebKit below 3x snaps every frame (desktop texture-resampling sizzle, device-judged), phone densities and Blink keep the velocity gate; plus opt-in resident-layer and shallow-freeze diagnostics.
  - Native first-frame hold disposes its backstop and stale callbacks; GPU prewarm is Blink-gated, refcounted, and deferred while a flight is active; landing snap honors sub-1 device pixel ratios.

## 1.22.1

### Patch Changes

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Land the in-flight arrival hold inside the transition's sub-pixel tail instead of after the COMPLETED flip. Once every participant of the choreography is within one CSS pixel of rest, the held content reflects while the compositor still owns frame production, keeping the release commit's layout and paint cost out of the settle window; unanalyzable choreographies keep the deferred post-COMPLETED landing.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Align the cupertino preset's kinematics with the measured native iOS navigation transition — 30% parallax on the covered screen (was 35%) and a 10% dim (was 20%) — and lengthen the glide to 0.7s (was 0.6s) on the same UIKit-spring bezier. The perceptual analyzers now ignore channels held constant across a variant, so a constant decoration never disables the completion cut.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Derive every transition deadline from the authored choreography instead of fixed constants: the task gate's ~1.2s backstop silently cut any longer authored transition mid-flight, and the choreography deferral's 1s cap cut any part authored more than a second past its screen. The gate, the liveness floor, and the deferral now all scale with the full choreography span (active, passive, and parts alike) plus the recovery margin — an authored duration of any length plays in full, and the backstops only ever fire on a genuinely stranded task.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Hold invisible consumer animations for the flight. An animation running inside an opacity-0 subtree (a delayed skeleton reveal and its shimmer layers) forces the compositor to create and raster every layer of that subtree the moment it becomes visible — mid-flight, that is a visible twitch. Such animations now pause while the screen is in motion (indistinguishable on glass — their output cannot be seen) and resume with the arrival-hold release at the choreography's rest point; visible animations are never touched.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Re-anchor the covered screen with the active one on main-thread stalls. The native stall re-anchor only shifted the active scope's participants, so on engines that present from the main thread a stall resumed the entering screen smoothly while the covered screen's parallax teleported the stalled span in one frame (the visible parallax snap on mobile Safari). The watcher now shifts every sibling screen's timeline in the same breath, with overlapping watchers deduplicated per frame.

## 1.22.0

### Minor Changes

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Split the screen-freeze decision into three modes (`computeScreenFreezeMode`): a DEEP screen (below the direct prev) freezes in the same commit that re-ranks it, only the just-covered screen's freeze keeps the quiet-window deferral, and participants wake immediately. Deferring deep freezes let a rapid push storm accumulate 15-20 live full-screen layers (no quiet window ever arrived), flickering and janking the whole app at depth — a regression introduced with the freeze deferral.

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Choose the motion driver per transition kind, measured from the authored keyframes: a transition whose screens move fast (peak translation ≥ 6 CSS px/frame, percentages resolved against the real screen box) runs on the native compiled-CSS clock even on engines that default to the rAF player, while fades, drifts, and unanalyzable choreographies keep the player. One navigation always runs on one driver, and a new `driver: "native" | "player"` transition option lets authors override the measurement.

### Patch Changes

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Widen the clean-end landing deferral from two to four frames so the COMPLETED flip's commit starts after the motion's final frames have cleared the presentation pipeline — measured on WebKit (main-thread presentation), the ~30ms flip commit at write+2 frames still delayed a pop's deceleration tail.

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Cap the player clock's advance at two frames per gap: a 40-100ms main-thread block used to slip under the old 100ms re-anchor cliff and fast-forward the authored curve in one frame (the screen "whooshing" ahead of its easing). Any stall now resumes at most two frames past where it stalled and the curve plays out in full.

## 1.21.1

### Patch Changes

- [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e) Defer a clean transition end's COMPLETED flip by two frames so the last motion frame presents before the convergence commit (status re-renders, freeze, animation strip) lands — removing the dropped frame measured right at landing. Recovery paths still resolve immediately.

- [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e) Hold the content-settle gate through React's suspense reveal throttle, keyed on state rather than timing: while the entering screen is still an animated skeleton (shimmering placeholders, nothing fetching, nothing mutating) the gate keeps waiting for the reveal commit, bounded only by the settle cap, and the anim-hold backstops now outlast that cap instead of firing underneath it. A de-shelled scope with nothing pending then releases on a two-frame anchor, so the reveal lands before the motion starts without paying the full quiet window.

- [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e) Count the entering screen's first-screenful image loads as in-flight work in the content-settle gate: an incomplete eager image now holds the motion (under the same settle cap) the way a pending fetch does, so image paints land before the flight instead of stealing a frame during it. Below-the-fold and not-yet-started lazy images are skipped.

## 1.21.0

### Minor Changes

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Enter complete on pushes: a freshly-mounted PUSH destination whose requests are still in flight waits (bounded) for its first content wave to land and settle before the motion starts, so a cold navigation slides in already filled instead of assembling mid-flight. Replaces (bottom-tab switches), warm entries, and pops pay nothing.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Remove the consumer-animation quarantine: the compiled sheet no longer sets `animation: none` on the consumer's own elements and `::before`/`::after` pseudo-elements inside entering screens. Consumer-authored animations (skeleton shimmers, ambient loops) now run exactly as written during transitions.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Engine-scoped motion driver: on non-Blink engines the rAF player drives every screen transition on one shared clock; Blink keeps the compiled compositor path. WebKit presents compiled CSS animations from the main thread, so a fetch commit landing mid-flight eats the remaining span and the transition snaps; the player's re-anchoring resumes from the freeze and plays the remainder, delayed but complete.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) A replace arriving mid-transition now supersedes the in-flight transition (fast-forwards it and starts immediately) instead of being silently dropped. Rapid bottom-tab switching no longer swallows taps that land inside the previous tab's flight, and lag no longer accumulates behind queued fades.

### Patch Changes

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Pre-warm the compositor while the user interacts. The per-flight warm-up starts with the flight, so the first navigation after an idle period still paid the pipeline's wake-up inside its opening frames. The warm-up now rides any interaction (pointer movement, wheel, touch, keys) — a pointer moving toward a tap precedes it by seconds — renewed at a throttled cadence and released shortly after interaction stops.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Warm the compositor for the length of every flight and decode oversized images off the main thread. Fixes the one-frame opening judder on cold transitions and the WebKit tab fade being swallowed when a fetching screen's image decode lands inside the flight.

## 1.20.0

### Minor Changes

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Hold in-flight content changes until the screen is at rest. A cold navigation's async data can land mid-flight — section swaps, streamed additions, and in-place text/attribute updates — while the screen is still decelerating, which reads as mid-transition stutter. The engine now parks departing nodes, holds arrivals off-glass, and reverts in-place writes during the flight, reflecting everything in one commit at COMPLETED (or the instant the transition is interrupted) — the shipped delayed-but-complete contract extended from mount time to flight time.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Suspend consumer CSS animations (pseudo-elements included) inside a navigation's freshly mounted entering screen (push/replace), starting them when the screen arrives; `<Part>` elements are exempt, and the visible exiting screen and the pop destination are untouched (a pop destination's animations restart at the unfreeze commit under the flight's own motion). A cold first entry can mount hundreds of animated placeholder shimmer layers whose compositor commit swallows the whole transition window — measured on an iPhone as a fade presenting zero intermediate frames. With the quarantine, a first entry plays the intended transition identically to re-entries.

### Patch Changes

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Complete a navigation when its whole choreography completes: a passive side or `<Part>` whose registered motion outlives the active screen's animation was truncated mid-flight by the COMPLETED flip at the active animationend (visible as the part snapping right at the convergence). A clean end now defers the task resolution by the difference, bounded, so the full choreography plays; the perceptual cut composes with it (a part resolves at its own sub-perceptual point).

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Make the compiled compositor animation the default screen-transition driver on every engine, with no automatic or mid-flight driver switching. Per-frame screencast diffing on real Chrome showed the rAF player's px-snapped writes shiver at the deceleration tail (hold/1px-step alternation) while translate3d-compiled keyframes decay monotonically to rest — the Blink judder the player was built to route around no longer exists — and under CPU throttle the compositor plays every fade on time while a main-thread player collapses. The player remains available behind the `flemo:motion-driver-force` pin for diagnostics; the pin is now session-scoped (sessionStorage), and a legacy localStorage pin is removed and never honored.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Keep the convergence frames light. Resting screens deeper than the transition pair no longer re-render on status flips (previously an O(depth) re-render plus attribute-write storm landed exactly on the final frames of every navigation), and the in-flight landing now presents two frames after COMPLETED instead of inside the convergence commit — with an immediate land if a new navigation starts first.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Resolve reveal-shaped transitions (static enter over an animated exit) on the passive side's motion span, keeping the navigation task anchored to the visible motion instead of resolving on a microtask.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) End a transition the moment its remaining motion drops below one device pixel (and one opacity step) on every animated channel, computed analytically from the easing curve. The asymptotic tail of a deceleration curve spends 150ms+ moving sub-pixel distances, which presents nothing but forces per-frame text re-rasterization at shifting anti-aliasing phases — visible as a fine shimmer at the convergence on scaled display pipelines. The cut presents pixels identical to the authored motion, includes every participating `<Part>`'s registered timing in its ceiling, stays inside the natural animation span, and yields to the recovery machinery (cancel-resume, watchdog) whenever the clock shifts.

## 1.19.1

### Patch Changes

- [`d979a33`](https://github.com/kimjh96/flemo/commit/d979a33db7642e70bb3687cd12593b789c7dcc39) Revert the shell-first children deferral and re-anchor the transition gate to the motion start. Screens enter with their real content in the first frame again — no blank shell, no late content pop-in, no perceived double render. A heavy mount commit now delays the transition start by exactly its cost instead of snapping the transition away: the gate backstop re-arms while the hold is pending and restarts with a full window when the motion actually begins.

## 1.19.0

### Minor Changes

- [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8) Start transitions against the screen shell: a screen mounting into a push or replace now renders its frame first and mounts consumer children in a deferred commit once the transition's first frame has painted, so heavy content can no longer freeze or swallow the animation. The rAF player also re-anchors its clock across long main-thread stalls, resuming motion instead of fast-forwarding to the end. `@flemo/core` gains a `shouldMountShellFirst` export so the shell-first decision stays framework-neutral, a new public API that lifts core to a minor bump.

## 1.18.1

### Patch Changes

- [`c2ddae3`](https://github.com/kimjh96/flemo/commit/c2ddae3e4ea6ade5cc5ee2c9651c152bb2f2232d) Survive browser-cancelled transition animations on every participant: when a mid-transition commit makes WebKit silently cancel a running screen, decorator, bar, or part animation, the engine now resumes it on its original timeline (negative-delay rejoin) instead of losing the exiting screen's fade or cutting the whole transition to a single-frame swap after one retry.

## 1.18.0

### Minor Changes

- [`4214525`](https://github.com/kimjh96/flemo/commit/4214525eba426cf29c3f00adeb404126c9cd6b67) Pair-release the anim-hold for every navigation (push and replace included, not just pop), scope the image-decode wait to screens actually waking from a freeze so the pairing costs nothing, and teach the transition engine to recover a cancelled screen animation (restart once, then a duration-based watchdog) instead of hanging until the 1.2s task gate and snapping with no transition.

## 1.17.0

### Minor Changes

- [`980af25`](https://github.com/kimjh96/flemo/commit/980af254371f322d1a7bdbbc657d449e6be464ed) Release the anim-hold of both screens of a pop together: a transition-scoped barrier (`createAnimHoldCoordinator`) waits for the pair's slowest readiness gate, so the revealed screen's image-decode wait no longer lets the exiting screen start first and the pop pair always moves on one clock, still bounded by the existing 300ms backstop. Push and replace timing is unchanged.

## 1.16.1

### Patch Changes

- [`15ab16b`](https://github.com/kimjh96/flemo/commit/15ab16b5c2dc0e8b015f965c8871358a9fc26532) Make <Part> motion natural across a swipe. Cleanups (COMPLETED strips, unmounts) now drop any in-flight settle without writing, so a late settle can never shadow the rest rules, and a committed swipe keeps the previous side's part landing values in place instead of stripping them a frame early (the engine's COMPLETED cleanup owns the strip). The playground's panel-title Part gains the reference swipe hooks: the returning screen's title recovers with the drag progress and settles the remainder on release, matching how the screens themselves move.

## 1.16.0

### Minor Changes

- [`39bc7ea`](https://github.com/kimjh96/flemo/commit/39bc7eab906cb785a50405be7ea7438f0e6c4293) Scope the motion-driver default to the rendering engine. The compositor defect the rAF player routes around was measured on Blink specifically, while a main-thread player starves WebKit's weaker mobile main threads (eye-confirmed janky on Safari, worst on iOS) whose compositor never had the defect. The player now defaults on only for Blink; WebKit and other engines keep the compiled compositor paths (CSS animations for transitions, CSS transitions for swipe settles) that served them before. The measured demotion policy and the diagnostic force key remain supreme on every engine, and nothing changes for Chromium users.

## 1.15.0

### Minor Changes

- [`1a21cfc`](https://github.com/kimjh96/flemo/commit/1a21cfc94a8a01fba0e920fa179e67e4d0d84448) Put the last two compositor-clocked motions on the player's clock. Swipe releases (the settle after a gesture lets go) now run as scrubbed single-keyframe Web Animations — the browser fills the start from the element's current position, exactly like the CSS transition they replace, while a shared main-thread clock steps every settling participant together; a new write to a settling element pins its current values first, so a re-grab takes over seamlessly. <Part> elements now join the navigation's shared player alongside their screen, bars, and dim, each with its own registered motion. Where WAAPI is unavailable the previous CSS paths remain byte-for-byte in charge, and settle frame gaps are deliberately excluded from the driver policy's demotion statistics (a release routinely overlaps the commit it triggers). The playground panel titles gain a "panel-title" Part demonstrating both.

## 1.14.0

### Minor Changes

- [`8236d28`](https://github.com/kimjh96/flemo/commit/8236d28865712207b02b5b701bbb9aab6f6405af) Extend the rAF player to EVERY motion a transition can declare. Values the numeric interpolator cannot pair (clip-path morphs across templates, calc() expressions, mixed units, one-sided properties) are now driven by a scrubbed Web Animation: created paused, its currentTime stepped every frame from the same shared clock, so the browser interpolates with exact CSS semantics while the progression stays main-thread-driven — the same compositor-jank immunity as the numeric tier, for built-in and user-authored transitions alike. The compiled CSS path remains only for replay chains, policy-demoted devices, and environments without WAAPI. The playground gains a "Wipe" transition whose mismatched clip-path templates exercise this tier end-to-end.

## 1.13.0

### Minor Changes

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Retune the cupertino preset: 0.6s both ways (was 0.7s enter / 0.6s back), a deeper -35% parallax on the receding screen (was -30%, mirrored in the swipe-back handlers), and a lighter rgba(0,0,0,0.2) dim (was 0.3), with the overlay decorator kept in lockstep at 0.6s.

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Pre-rasterize the PUSH-entering screen during the anim-hold ("park-under"): a screen entering from fully off-screen has no rasterized tiles, and Chromium then rasterizes them as the slide reveals — on raster-heavy content that froze a presentation frame mid-motion (a visible "tick"). The entering screen now parks at its destination beneath the previous screen for the hold window (container-level stacking demotion, gated on that screen's verifiably opaque surface, with the paused hold as fallback) and then replays its animation over the already-rasterized layer. Also restores the decode-wait wiring in the React binding — the scope was accidentally dropped in a refactor, shipping the image decode-wait dormant.

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Drive transition motion with a single-timeline rAF player instead of compiled CSS animations. Chromium's compositor-driven animations (CSS keyframes and WAAPI alike) intermittently miss presentation deadlines on raster-heavy layers — invisible to every JS metric and unfixable from CSS — while main-thread-driven transforms stay smooth (screen-recorded, single-variable A/B). All participants of one navigation (entering and exiting screens, dim decorator, riding bars) now step off one shared clock, x/y values snap to device pixels while moving at least one device pixel per frame (crisp leading edge without the compositor's erratic snapping) and glide unsnapped below that speed (snapping sub-pixel motion quantizes it into the end-of-transition shivering), and the anim-hold/park/decode pipeline gates the start exactly as before. Variants the player cannot provably interpolate (mismatched value templates such as clip-path morphs) keep the compiled CSS animation path unchanged, and a device whose main thread chronically starves the player (measured by its own frame gaps) earns a persisted demotion back to the CSS path — the library observes and decides; there is no consumer API.

### Patch Changes

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Compile x/y offsets to translate3d instead of translateX/translateY (keyframes, entering initial styles, and inline swipe animations alike). Chromium pixel-snaps a 2D-transform-animated layer when its content rasters heavily, repeating a frame roughly every six and catching up with a double-length jump — a visible stutter across the whole transition on gradient-heavy screens. The 3D form routes the layer through texture-filtered compositing, which glass-recorded A/B shows sliding monotonically to rest. WebKit behaves identically for both forms; curves, timings, and the API are unchanged.

## 1.12.1

### Patch Changes

- [`1d2edf0`](https://github.com/kimjh96/flemo/commit/1d2edf012f5030fa8c834a59c9c49ee500d8a30f) Make rapid and cross-zone back/forward bulletproof. Transition-gated tasks now carry a gate backstop, so a transition whose `animationend` is lost (screen frozen or torn down mid-storm) can no longer deadlock the navigation queue. The history sync gains a convergence pass that replays the browser's present entry through the normal classifier once traversals go quiet, so the content always reaches the URL. A traversal landing multiple entries below replays each screen as its own transition instead of dropping the ones in between. Transition definitions are reference-counted, so a frozen Router instance cleaning up no longer strips the definitions a sibling zone is still animating with (the "screens stop transitioning until something remounts" bug). And a nested Router's scope AND history sync now persist for the session across zone exits: a zone that is offscreen still hears traversals and applies them instantly, so it is already on the right entry whenever it is revealed — re-entering a zone resumes animated navigation instead of degrading to instant restores. A nested Router's URL-reflection is also fenced to its own zone: an effect flushing after the browser has already traversed to a foreign entry (backing to home mid-storm) can no longer rename that entry to the zone's seed URL — the permanent "address bar says one zone, screen shows another" corruption.

## 1.12.0

### Minor Changes

- [`51c9eac`](https://github.com/kimjh96/flemo/commit/51c9eacf9afcf68dcc1731e3d7fee5b443e7d9e6) Replay every queued back/forward traversal with its full transition — late but complete — restoring the pre-1.5.7 feel. Folding now happens only when this Router has rewritten the browser timeline since the event fired (a push truncated the forward stack, a replace swapped an entry): only then can a stale event reference a destroyed entry, which is the one case where replaying corrupts (proven by the convergence property test). A remounting Router also seeds with the present entry's identity instead of a generic root, so traversals back onto it match instead of being swallowed.

## 1.11.0

### Minor Changes

- [`bce265d`](https://github.com/kimjh96/flemo/commit/bce265d3e4b50823d3f557872e052ced5b4a72fe) Make history synchronization identity-based and convergent, fixing the duplicate-screen crash and skipped transitions under rapid back/forward. Traversals now classify by entry identity (entries we hold pop with their animation, gap jumps included) with browser-space frame stamps for direction; queued events coalesce to the browser's present entry so storms collapse into one converging transition; and queued in-app navigations align the stack to the entry the user actually saw (and abort entirely when their Router has since unmounted) before acting. Verified by a randomized convergence property test against a browser-history model.

## 1.10.1

### Patch Changes

- [`3580635`](https://github.com/kimjh96/flemo/commit/3580635dabf45d9ce23743ff17440750e4bc9ffe) Keep the screen and the URL in lockstep under rapid back/forward traversals across a nested Router boundary. A traversal task whose Router unmounted before it ran now aborts instead of deadlocking the shared navigation queue; a nested Router derives its history-state key from its enclosing screen's entry id so a remount can read the frames its previous incarnation wrote; a traversal that cannot be faithfully classified adopts the entry without a transition instead of ignoring it; and a remounted Router no longer renames a history entry the browser had already moved past.

## 1.10.0

### Minor Changes

- [`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586) Protect transitions from image re-decode and reveal-raster jank, whatever assets a consumer uses. A frozen screen's decoded images are discarded by the browser; the anim-hold release now waits (bounded) for the entering screen's images to re-decode, a covered screen entering on pop parks at its destination during the hold so its tiles pre-rasterize (gated on the covering screen's background being opaque, with the paused hold as fallback), and every unfreeze eagerly re-decodes the screen's images so a swipe reveal — which no hold can cover — starts warming immediately.

## 1.9.0

### Minor Changes

- [`40d8584`](https://github.com/kimjh96/flemo/commit/40d8584c75291b96b10a3cda59c93d40acc3209c) Finish the framework-neutralization pass: `resolveTransition` (name → registered transition with the `none` fallback) and `subscribeStepParamsRestore` (step-frame param restore on back/forward) move into `@flemo/core`, and the React binding delegates to them. No behavior change.

## 1.8.0

### Minor Changes

- [`4e54577`](https://github.com/kimjh96/flemo/commit/4e545777a41fa1dac7b23aba193cc85f3cf73c7f) Move every framework-neutral piece of the React binding into `@flemo/core` so future bindings (Svelte, Solid) reuse it: `createStepController` (step push/replace/pop orchestration), `createRouterScope` (store-bundle creation/seeding, with the `FlemoStores` type), `buildRoutePath`, `matchesPathname`, `enteringInitialStyle`, `registerTransitionDefinitions`, `observeBarHeight`, and `observeViewportScrollHeight`. `@flemo/react` now delegates to them with no behavior change.

## 1.7.0

### Minor Changes

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Fix a shared bar riding a frame behind its screen on browser-back navigation. `data-flemo-bar-riding` is now computed in render and committed alongside the bar's status, so the bar starts its keyframe in the same frame as the screen for any transition and any trigger (a programmatic `pop` or the browser back button). The internal `driveBarRiding` engine helper is replaced by the pure `computeBarRiding`.

### Patch Changes

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Anchor a transition's start to the screen's first painted frame. iOS WebKit starts the animation clock when the style commits, so a heavy entering screen (large list, fetch-on-mount) burned the opening of the transition rasterizing its first frame and the animation visibly skipped ahead; the animation is now held paused for the first two frames and then plays its full duration against already-painted layers.

## 1.6.1

### Patch Changes

- [`7513f82`](https://github.com/kimjh96/flemo/commit/7513f82eac7788d7c49ba57efd248a60b4d906f2) Fix the swipe-back gesture not starting. The controller located the previous screen through a freeze wrapper element that the React `<Activity>`-based screen freeze no longer renders, so the drag found no screen to reveal and bailed. It now walks direct sibling containers to find the previous screen.

## 1.6.0

### Minor Changes

- [`9937291`](https://github.com/kimjh96/flemo/commit/993729187939f96122381cd740343a7a8878efc1) Expose pluggable history drivers. `createNavigationController` / `createHistorySync` can now run against an injected `HistoryDriver` instead of the browser History API: `createBrowserHistoryDriver` (the default) or `createMemoryHistoryDriver` for a local, in-memory stack.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Let a Router run on a custom history backend. Router accepts a `createDriver` factory, and HistoryDriver gains `readPathname()`, so the Router reads and writes the URL only through its driver. A wrapper (e.g. a locale-aware driver that keeps a `/ko` prefix in the address bar while the Router matches unprefixed paths) can now own the whole URL surface without the Router touching window.location directly.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add a per-Router `history` prop (`"browser"` default, `"memory"` opt-in) that decouples the history backend from nesting. A nested `<Router>` now participates in browser back/forward by default, while `history="memory"` keeps its previous isolated in-memory stack. Browser Routers namespace their `window.history.state` by a stable key and use a per-Router self-pop guard so multiple browser Routers coexist without clobbering each other.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Rename the `Screen` bar props to position-based, platform-neutral names: `appBar` to `topBar`, `navigationBar` to `bottomBar`, `sharedAppBar` to `sharedTopBar`, `sharedNavigationBar` to `sharedBottomBar` (the exported `SharedBarPresence` fields rename to match). Behavior is unchanged. This is a breaking rename: update any `Screen` that sets these props. The old `navigationBar` was easy to misread since it means the top bar on iOS and the web, while flemo uses it for the bottom one.

### Patch Changes

- [`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13) A `<Router>` nested inside another is now a local transition region: it runs its own in-memory history (no browser back/forward, no URL change) and contains its screens to its box via `position: absolute`, so only that region transitions while the surrounding layout (sidebars, headers) persists. A root `<Router>` is unchanged.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Make usePathname report a pop's destination immediately, consistent with push. The history store tracks a `pendingIndex` that advances to the target as soon as a pop starts (the render index still lags on the leaving screen until the transition resolves), and usePathname reads it. A browser Back no longer leaves chrome (active nav highlight, breadcrumbs) on the old route until the back animation finishes.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Fix useStep losing the screen's params in a keyed browser Router (a nested Router, or more than one Router on the page). pushStep/popStep and the step param restoration now go through the Router's own driver and self-pop guard, so closing a step (close button or browser Back) returns to the screen it was opened from instead of resetting to the first one. A deep-linked screen now seeds its params into the history frame too.

## 1.5.0

### Minor Changes

- [`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1) Add progress-driven part transitions. `createPartTransition` defines a named, status×active animation for a single element (any CSS property), and `<Part name="...">` runs it on that element anywhere inside a screen: an app/navigation bar child, body content, anything. Programmatic transitions play on the compositor with no React re-render, and the same definition follows the swipe-back drag inline. Register the transitions through the `Router`'s `partTransitions` prop. `createRawPartTransition` gives full per-variant control.

## 1.4.0

### Minor Changes

- [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6) Make the navigation stores request-scoped so screens render during SSR. The
  history/navigate/transition/screen stores are no longer module-level singletons
  shared across every SSR request; the Router now creates one bundle per mount,
  seeds it from `initPath`, and provides it via context. Because the seed is the
  store's initial state, zustand hands it to React as the server snapshot, so the
  screen stack paints on the server (previously the root was empty until the
  client mounted) and each concurrent request keeps its own stack.

  The public API (`Router`, `Route`, `useNavigate`, `useParams`, `useScreen`,
  `Screen`, `LayoutScreen`) is unchanged. Internally, `@flemo/core` now exposes the
  stores as `createHistoryStore` / `createNavigateStore` / `createTransitionStore`
  factories instead of singleton hooks.

### Patch Changes

- [`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551) Roll up Renovate dependency updates. Bump runtime and peer ranges: `react`/`react-dom` to `^19.2.7`, `motion` to `^12.40.0`, `path-to-regexp` to `^8.4.2`, `zustand` to `^5.0.14`. Also refreshes web app and toolchain deps (next, fumadocs, tailwindcss, eslint, typescript, vite) with no API changes.

## 1.3.0

### Minor Changes

- [`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f) `useNavigate().pop` now accepts a `transitionName` to override the back animation — handy when collapsing several screens with `skip` / `until`, where the leaving top's own transition isn't the one you want. The override is applied in the same commit that starts the pop, so the original transition never paints a frame.

## 1.2.0

### Minor Changes

- [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef) `useNavigate().pop`, `replace`, and `push` now take an optional distance — `{ skip }` (a number of screens) or `{ until }` (a route pattern) — to reach a screen below the top in a single transition. The skipped screens are removed without ever painting, so they never flash by.

  All three reach the same target (`{ skip: n }` is the screen `n` below the top; `{ until }` is the nearest match) and differ only there: `pop` lands on it, `replace` replaces it (the target and everything above become the new screen), and `push` keeps it and stacks the new screen on top.

  `{ skip }` clamps to the stack depth; an unmatched `until` is a no-op for `pop`/`replace` and a plain push for `push`. Plain `pop()` / `replace(path)` / `push(path)` are unchanged.

### Patch Changes

- [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056) Make the cupertino transition's outgoing-screen parallax viewport-proportional. The previous screen now slides to `-30%` of the viewport width (matching iOS), instead of a fixed `-100px` that looked negligible on wide viewports and appeared to lag behind the incoming screen.

- [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056) Fade the material transition's outgoing screen as it slides up, so the previous screen dissolves instead of just nudging behind the incoming one. Swipe-back mirrors the same fade.

- [`6df7e4f`](https://github.com/kimjh96/flemo/commit/6df7e4fd5c3446771fbc9602d703273e75615af6) Drop the explicit cupertino easing from the overlay decorator's push/pop dim so it animates on the default ease curve.

## 1.1.2

### Patch Changes

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Align the `overlay` decorator's `enter` / `exit` duration and easing to cupertino's push / pop slides (0.7s / 0.6s, cubic-bezier(0.32, 0.72, 0, 1)). The keyframe now reaches its `to` value exactly when the screen status flips to COMPLETED, eliminating the `fill: both` hold sub-window where the rest-rule handoff could race against the compositor. Swipe handler durations stay at 0.3s so the gesture release remains responsive.

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Hold `overlay`'s `backgroundColor` static at the target dim across every variant so only `opacity` is keyframe-animated. Effective dim is now `opacity × 0.3` (linear) instead of the previous `opacity × bg_alpha` product (which produced ≈0.075 at midpoint — barely visible — and jumped to 0.3 only at the very end). The keyframe is also single-property, which avoids iOS Safari's known color-space interpolation quirks for `background-color` under a transformed ancestor and shrinks the `will-change` hint to `opacity` alone.

## 1.1.1

### Patch Changes

- [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93) Compile `contain: layout` and `pointer-events: none` into transitioning variant rules alongside `will-change`. Scoped to `PUSHING` and `REPLACING` only — the verbs that actually trigger a fresh screen mount. Pop is excluded: ScreenFreeze keeps the destination screen mounted so there's no mount work to isolate, and harness measurements showed a small but consistent regression on heavy-DOM exiting screens during pop attributable to containment-block evaluation cost. The hints activate only during the transition window and are released the instant the status flips back to `IDLE`/`COMPLETED`.

## 1.1.0

### Minor Changes

- [`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2) Fix `createDecorator` so the decorator transition runs on the right screen. Previously every `*-true` variant (active side) and every `*-false` variant (inactive side) was forced through the two-state `enter` / `exit` pair: `IDLE-true`, `PUSHING-true`, `POPPING-true`, and `COMPLETED-true` all mapped to `enter`, while `PUSHING-false`, `REPLACING-false`, and `COMPLETED-false` all mapped to `exit`. That collapse meant the active side had to use one value for both "active at rest" and "the entering animation's target," which only worked if the two were identical — for the built-in `overlay` they were (`opacity: 0` for both), and the result was that no decorator animation was visible at all on the new screen entering or the previous screen going behind.

  `createDecorator` now takes a required `idle` separate from `enter` / `exit`, with three distinct roles:
  - `idle` — resting position. Held at IDLE-*, COMPLETED-true, POPPING-true, and the *new\* screen during PUSH / REPLACE (`PUSHING-true` / `REPLACING-true`). The entering screen lands here so its decorator stays invisible on top of the new active screen.
  - `enter` — target for the screen moving INTO the background. Used on `PUSHING-false` / `REPLACING-false` (peak) and `COMPLETED-false` (settled). For overlays this is the dim state — the previous screen darkens.
  - `exit` — target for the previously-behind screen returning to active on `POPPING-false`. Animates from `enter` (its prior settled position) toward `exit`. Match `exit` to `idle` to land softly on the active rest rule.

  The built-in `overlay` decorator picks the new mapping up natively, so cupertino's push now darkens the screen sliding behind (was statically mounted before) and pop now smoothly clears the dim as the previous screen returns. Authors who used `createDecorator` directly must add an `idle` argument; per-state control via `createRawDecorator` is unchanged.

## 1.0.2

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.

## 1.0.1

### Patch Changes

- [`a6a3550`](https://github.com/kimjh96/flemo/commit/a6a35501ba640ed1cfa72e202fc4ef53cf487704) Stop appending `px` to CSS custom property values during transition compilation. `{ "--space": 16 }` now compiles to `--space: 16;` instead of `--space: 16px;`. Custom properties are typeless — flemo can't know whether the author intends pixels, a count, a ratio, or a multiplier — so the safe default is to pass the raw scalar through and let the call site shape the unit (e.g., `calc(var(--space) * 1px)` in CSS). Mirrors React's `name.startsWith("--")` short-circuit in inline-style coercion.

- [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb) Compositor-synced shared-bar ride-along. The previous rAF mirror loop read `getComputedStyle(scope)` and wrote inline styles onto the bars every frame — a main-thread roundtrip that left bars trailing the screen by one composited frame, especially visible on mobile. The compiled transition rule now emits a sibling selector targeting `[data-flemo-bar][data-flemo-bar-riding="true"]` with the same `@keyframes` the screen uses, so the bar runs the same animation on the same compositor pass — zero JS in the loop, pixel-exact sync. The rAF path is retained narrowly for swipe-drag, where the screen itself is already main-thread inline-driven and there is no compositor advantage to chase.

- [`f3e8ac9`](https://github.com/kimjh96/flemo/commit/f3e8ac9dd909fabc11621f6bd29449c286fb3bda) `TransitionTarget` now extends `csstype.Properties`, so every transition-able CSS property — `filter`, `backdropFilter`, `color`, `boxShadow`, `borderRadius`, `clipPath`, `letterSpacing`, and the rest of the CSS surface — gets full IDE autocomplete and value-type narrowing inside `createTransition({ initial, idle, enter, ... })`. The previous interface only typed transform shortcuts, `opacity`, and `backgroundColor`; every other property still worked at runtime thanks to the broad index signature, but offered zero editor support. flemo-specific transform aliases (`x`, `y`, `z`, `scale*`, `rotate*`) keep their existing semantics — csstype's own `rotate` / `scale` / `translate` standalone properties are omitted so the shortcut wins. CSS custom properties (`--foo`) remain animatable via a `--`-prefixed index signature.

- [`04a03d9`](https://github.com/kimjh96/flemo/commit/04a03d985d5517d87d570ea8b696dbaee3ef334e) Stop appending `px` to unitless CSS property values during transition compilation. Numbers passed to `lineHeight`, `fontWeight`, `zIndex`, `flexGrow`, `flexShrink`, `aspectRatio`, `columnCount`, `order`, `tabSize`, SVG opacity / stroke numerics, and similar unitless properties now compile straight through (`{ lineHeight: 1.5 }` → `line-height: 1.5;`). Previously the compiler defaulted any non-transform number to `…px`, which emitted invalid declarations like `line-height: 1.5px`. String values were already passed through verbatim, so the existing `"1.5"` workaround stays compatible. Mirrors the well-known unitless-property allowlist React uses for inline styles.

## 1.0.0

### Major Changes

- [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616) - Stabilize the public API at 1.0.0. The screen / transition / navigate / store surfaces (Router, Route, Screen, useNavigate, useStep, useScreen, useParams, createTransition, createDecorator, TaskManger, history & navigate stores) are now SemVer-major versioned — future breaking changes go through an explicit major bump and a migration note in this changelog. `@flemo/react-layout` stays in `0.x` until its motion-free FLIP migration lands.

### Minor Changes

- [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44) - Initial release of `@flemo/core` — flemo's framework-agnostic primitives. Contains the navigation queue (`TaskManger`), history + navigate zustand stores, the self-pop guard, the transition + decorator factories with built-in presets (`cupertino`, `material`, `layout`, `none`, `overlay`), the CSS keyframes compiler, and pure utilities (`isServer`, `getParams`, `getMatchedPathPattern`, `findScrollable`). No React or Motion runtime dependency — animation target types are defined locally. `@flemo/react` depends on it; consumers who only need transition primitives can install `@flemo/core` directly.

- [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335) - Restore coexistence with consumer overlays (bottom sheets, dialogs) that rely on `position: fixed` and z-index. The screen scope no longer establishes a containing block or stacking context at rest: identity transform targets compile to `transform: none`, and the screen wrapper uses `contain: layout style` instead of `contain: strict`. The shared app/navigation bar ride-along is now generic over every property a transition writes — `collectAnimatedProperties` is mirrored from scope to bar each frame — so authoring a custom transition with `opacity`, `filter`, or any other CSS property no longer leaves the bar out of sync.

### Patch Changes

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - `findScrollable` correctness + side-effect fixes that show up on every swipe-back pointerdown:
  - `canProgrammaticallyScroll` no longer mutates the candidate's `scrollTop` / `scrollLeft` to probe scrollability. It now reads `overflowX` / `overflowY` from computed style instead — same intent (does this element actually scroll on this axis?) without firing scroll events or interfering with `scroll-snap` / `scroll-behavior: smooth` consumers.
  - The ancestor walk no longer stops at `document.body`, so viewport-level scrolling on `<html>` (`documentElement`) — the default for many apps — is now detected as a scroll boundary and gates swipe-back correctly.
  - `getStartElement` now returns `null` instead of force-casting non-Element event targets (`document`, `window`, `Text`) to `HTMLElement`, avoiding a downstream crash in the parent-walk loop.

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Fix `TaskManager.resolveTask` rejecting `SIGNAL_PENDING` tasks. `emitSignal` delegates to `resolveTask`, so the previous status guard turned signal mode (`control.signal`) into a permanent no-op — any task parked on a signal would have hung indefinitely. Both `MANUAL_PENDING` and `SIGNAL_PENDING` now flow through the same resolution path.

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Emit `will-change` on each compiled transition's variant rule, derived from the exact set of properties the transition writes — whatever the author put in `initial` / variant `value`s. The hint applies while the variant's status selector matches (PUSHING/POPPING/REPLACING) and releases the moment status flips back to IDLE/COMPLETED, so the compositor layer is allocated only for the animation window. Shared bars riding along via JS mirroring receive the same per-transition property set. Sustained 60fps for any author-defined transition target, not just transform/opacity.
