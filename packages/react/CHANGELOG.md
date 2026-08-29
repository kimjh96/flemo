# @flemo/react

## 2.1.0

### Minor Changes

- [`18ac23f`](https://github.com/kimjh96/flemo/commit/18ac23ffd88196f13097a7729832b4e7b9076793) Run a decorator on the clock of the transition that names it. Timing on a decorator variant is now optional and inherits the screen's duration and delay for the same variant key, so one dim is longer on a slow transition and shorter on a fast one without being authored twice; write a `duration` only to override it, including `0` to snap, and note that a variant that previously omitted one snapped where it now inherits. `ease` is never inherited.

### Patch Changes

- [`1ca911b`](https://github.com/kimjh96/flemo/commit/1ca911b7be274785801e44e75ff650c124366a6b) Fix a swipe-back inside a `history="memory"` Router leaving the stack unpopped. A memory Router now mounts the history sync like a browser one, so the gesture's commit reaches its stores; without it the dismissed screen stayed active off-stage and swallowed every tap that followed.

- [`ce12ca5`](https://github.com/kimjh96/flemo/commit/ce12ca53e6cea863cc415868571a084d8fd0bf03) Fix a shared bar travelling the wrong distance under a vertical transition. A riding bar runs the screen's keyframes on its own box, so a percentage offset resolved against the bar's height instead of the screen's: a material push moved a 104px bar 104px while its 770px screen moved 770px, landing the bar alone at the top of a screen still off the bottom of the viewport. The bar now runs a copy of the keyframes measured against the screen box, and a swipe release resolves the same offset the same way. Horizontal transitions are unchanged, because a shared bar is already exactly as wide as its screen.
- Updated dependencies ([`c5f5e21`](https://github.com/kimjh96/flemo/commit/c5f5e2186d88ee679f5a26caa96c3457da51c41d), [`18ac23f`](https://github.com/kimjh96/flemo/commit/18ac23ffd88196f13097a7729832b4e7b9076793), [`0c6f4ab`](https://github.com/kimjh96/flemo/commit/0c6f4ab5f6ff247acd863b09c2c81348cfe4efe4), [`9f95915`](https://github.com/kimjh96/flemo/commit/9f959156e5bcce52b540a665275ba94639662c7c), [`17219e6`](https://github.com/kimjh96/flemo/commit/17219e621d7932564299e28358abf47327d53079), [`1ca911b`](https://github.com/kimjh96/flemo/commit/1ca911b7be274785801e44e75ff650c124366a6b), [`ce12ca5`](https://github.com/kimjh96/flemo/commit/ce12ca53e6cea863cc415868571a084d8fd0bf03), [`0e54a0d`](https://github.com/kimjh96/flemo/commit/0e54a0d6a4eb345964654256426b1fec7783603d), [`eaebb08`](https://github.com/kimjh96/flemo/commit/eaebb08ec576dc158af32e3a986451f575d4fdb6)):
  - @flemo/core@2.1.0

## 2.0.0

### Major Changes

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Remove the `layoutId` navigation option. It was threaded from `push()` and `replace()` through the history frame, the browser's history state, the popstate bridge and the screen context, and nothing ever read it — shared elements are paired by the `layoutId` prop on `<Morph>`, which is a different thing entirely. Passing it to `push`/`replace` is now a type error; delete the argument.

### Minor Changes

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Let a swipe drive a morph. The shared element now stages its flight when the drag starts — both ends are already on screen, so the destination can be measured — holds it at zero, and follows the finger, then plays out to the arrival on a commit or back to where it started on a cancel, at the same speed the screens settle at. It runs no frame loop of its own: the animations are the browser's, and the gesture sets their time. Any transition that declares a `swipeDirection` gets this without authoring anything.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Shared-element morphs are now flemo's own, with no animation library behind them. `<Morph layoutId="...">` (from `@flemo/react`) marks an element that exists on two screens: the arriving one starts on its partner's BOX and grows into its own. It animates the box, not a scale — so the subtree lays itself out at every size on the way and paired text is re-typeset rather than blown up — and it carries a copy of what it replaces — painting only the parts of it that have no counterpart on the other side, so nothing is drawn twice — which dissolves away as it travels. For the length of the flight the element is staged in a layer above both screens, so no scroll container can clip it, no opaque arrival can cover it and no sliding transition can carry it along — which is what lets one morph look right under any screen transition, cupertino and material included. Morphs nest, and a nested one rides its container — so a card stays a card for the whole trip instead of coming apart in the air. A container, a whole screen, or a screen and the elements inside it are all the same feature at different sizes, and what happens BEHIND the element (a background that recedes and blurs, say) stays the screen transition's job: the two keep step because a morph with no duration of its own inherits the flying screen's. Author the choreography with `createMorphTransition`, exactly like every other flemo transition, or take the built-in `shared` preset: it inherits the flying screen's timing, so the element lands with its screen. The travel runs on the compositor as a single per-flight keyframe and obeys the same animation hold the screens do, so it starts on the same frame with no timing code on either side.

- [`98ede19`](https://github.com/kimjh96/flemo/commit/98ede190f0cdf8239b96a0c5fa78700bc69d700e) Add `<Layer>`, which renders a consumer overlay beside its screen so it can cover the shared bars while the screen is moving. The overlay leaves the screen for paint order only: it stacks by its owning screen, runs that screen's keyframes so it travels and leaves with it, and stops painting when that screen is covered. Screens now state their internal paint order (content under chrome, chrome under an overlay, the dim over all three) instead of inferring it from element order.

### Patch Changes

- [`5c0dcc0`](https://github.com/kimjh96/flemo/commit/5c0dcc0cb9a24d5dc7647428d7c88f111c172353) Key a shared bar's height observation on whether the screen has that bar rather than on the identity of the node passed to `sharedTopBar` or `sharedBottomBar`. A screen that re-renders no longer disconnects and re-attaches the bar's ResizeObserver or forces a layout read in the pre-paint window on every one of those renders.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Anchor the flight layer to the app's own frame instead of the viewport. A root Router's layer was fixed, on the reasoning that a root Router owns the screen — but that is one deployment of a root Router, not the only one. Mounted inside a bounded frame (a device preview, an embedded region, a modal) the viewport is not its box, so a shared element in flight painted straight through the frame's rounded corners while every screen inside it stayed clipped. The layer is now absolute in both cases, sharing whatever box — and whatever clip — the app gave its screens.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Stop painting a covered screen in the commit it is covered, on every platform. A freeze does two things — the screen stops painting, and the screen is released (effects unmounted, boxes dropped, raster let go) — and they were one commit, so the delay the expensive half needs was also delaying the cheap one. A covered screen went on painting until it was released: 600ms for the screen a pop can return to, and on desktop Blink three seconds on top of that. Nothing above a screen is obliged to be opaque, so that was a stack showing through itself for the whole wait. Paint now stops immediately and uniformly; the release keeps its clock, and a deep screen — never what a pop wakes — is released at once everywhere instead of waiting out a debounce that exists for a round trip it cannot be part of.

- [`1f7f78f`](https://github.com/kimjh96/flemo/commit/1f7f78f66804a8d9341ab3386f188541aeac8e0b) Keep a screen's stacking to itself while a `position: fixed` overlay still reaches the viewport. Screen containers isolate and carry their stack position, so a covered screen's dim and a consumer's own `z-index` can no longer paint over the screen that replaced them, and a bottom sheet in a nested Slot still covers the surrounding shared bars.

- [`bd06124`](https://github.com/kimjh96/flemo/commit/bd06124403774b3e806087fc05b111cec30cb8c8) Let fixed overlays inside a nested Slot cover surrounding shared bars without portals or consumer workarounds. Clarify when fixed overlays escape the Slot boundary.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Commit a swipe-back on the Router that owns the screen instead of on the page. The binding called `window.history.back()` directly, which is the same thing the driver does for a browser Router and a different history entirely for a memory one: a swipe inside a `history="memory"` stack walked the whole document backwards rather than popping the stack the finger was dragging.
- Updated dependencies ([`e937f57`](https://github.com/kimjh96/flemo/commit/e937f5714581a36a52a9cbd961e3eca483307a56), [`08f8494`](https://github.com/kimjh96/flemo/commit/08f8494be3fc0118c08fa7746e726c298253d9ea), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`69ac179`](https://github.com/kimjh96/flemo/commit/69ac179a479706c2704be7f45497c136bd12b16b), [`d006b5f`](https://github.com/kimjh96/flemo/commit/d006b5f729c9178acc2f633cd8fb521376f7e797), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`98ede19`](https://github.com/kimjh96/flemo/commit/98ede190f0cdf8239b96a0c5fa78700bc69d700e), [`fefc815`](https://github.com/kimjh96/flemo/commit/fefc8155a4dafdc614d9be4d2152569f71c9bbb9), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`2f1e394`](https://github.com/kimjh96/flemo/commit/2f1e394a9c95de44e11f9bad49340b95acdbc4a3), [`8e5e401`](https://github.com/kimjh96/flemo/commit/8e5e40144264e39a6cf804b87b1b8194a7b60be6), [`52ff075`](https://github.com/kimjh96/flemo/commit/52ff0759973b5f1ee87079a3a0fd796bf7952827), [`27425a9`](https://github.com/kimjh96/flemo/commit/27425a96b47042ac665008c1ce89ad47f031497e), [`d006b5f`](https://github.com/kimjh96/flemo/commit/d006b5f729c9178acc2f633cd8fb521376f7e797), [`2741f85`](https://github.com/kimjh96/flemo/commit/2741f8515f2f0e4e4288f2d7b07ea76a5b13d183), [`57bbab4`](https://github.com/kimjh96/flemo/commit/57bbab432c4cfa76c04c7a5f0546c2b6cc6a6204)):
  - @flemo/core@2.0.0

## 1.12.8

### Patch Changes

- [`5b83d3b`](https://github.com/kimjh96/flemo/commit/5b83d3b46ed268ee07e834e7d7819a4e577a1111) Declare the `data-flemo-*` DOM contract in one place. `@flemo/core` now exports the
  whole protocol — every attribute name, the animation hold's values, and selector
  helpers — instead of spreading ~27 string literals across four packages where a
  rename broke the others silently. Consumers styling or querying flemo's attributes
  can import the names rather than hard-code them.

  The contract is now enforced from both ends: core fails its own suite on any raw
  `data-flemo-*` literal, the React binding fails if it renders an attribute core does
  not declare, and the devtools recorder's deliberately-separate copy is pinned against
  core's table.

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

- [`9f1205c`](https://github.com/kimjh96/flemo/commit/9f1205c42d37f354828c17463862dd0838d0c0ba) Stop a swipe gesture from surviving the pointer that started it. While a drag is armed the screen suppresses native touch scrolling, and that flag could only be cleared by a pointerup carrying the id that armed it — so when the browser never delivered one (Safari drops the remaining pointer events when the element holding capture is removed or hidden), the screen stopped scrolling for good, and the next press could not recover it either. A gesture now also ends on `lostpointercapture`, on the next primary press, and when the screen unmounts or freezes underneath it.
- Updated dependencies ([`8cb6366`](https://github.com/kimjh96/flemo/commit/8cb636674b2634510253d2265569904c6da05e69), [`5b83d3b`](https://github.com/kimjh96/flemo/commit/5b83d3b46ed268ee07e834e7d7819a4e577a1111), [`d70ced3`](https://github.com/kimjh96/flemo/commit/d70ced37926a359b192b5f5b3b8f9151f340ec5b), [`7b7fdd3`](https://github.com/kimjh96/flemo/commit/7b7fdd3595c8697967b9db56f6aea1aa942b149f), [`d15b18a`](https://github.com/kimjh96/flemo/commit/d15b18ad91687a7e564f0f8be54e55554b181adf), [`05e4d40`](https://github.com/kimjh96/flemo/commit/05e4d4072d4cd5555ef63cfde8dd0e8985426720), [`28fb128`](https://github.com/kimjh96/flemo/commit/28fb1280661f1d886f898310c5b86318e2772d36), [`3ddef71`](https://github.com/kimjh96/flemo/commit/3ddef71eed6bd53b2624d190668390295019c9ac), [`d250cc5`](https://github.com/kimjh96/flemo/commit/d250cc5bf3dbc9b8699f6387c219311bd23dca28), [`a4c1a74`](https://github.com/kimjh96/flemo/commit/a4c1a744f343b86352cc74e1616144f1b35109ad), [`ebf7d78`](https://github.com/kimjh96/flemo/commit/ebf7d786bd8a8154d9322796f2bec413fcf9131e), [`e67146a`](https://github.com/kimjh96/flemo/commit/e67146a4c6857d90de88c372732a92d005e6d305), [`a8ed9cd`](https://github.com/kimjh96/flemo/commit/a8ed9cd4aa3298eb6e3e6fc38930de3056f3ebc3), [`f32c2cc`](https://github.com/kimjh96/flemo/commit/f32c2cc7022dd8d32382420c3a26054546cfaf48), [`fbd937c`](https://github.com/kimjh96/flemo/commit/fbd937c2fe15b451c6b216e524379d85a4cf5849), [`9f1205c`](https://github.com/kimjh96/flemo/commit/9f1205c42d37f354828c17463862dd0838d0c0ba)):
  - @flemo/core@1.30.0

## 1.12.7

### Patch Changes

- Updated dependencies ([`47332c9`](https://github.com/kimjh96/flemo/commit/47332c92c2b530e4b1fc2426b62dcfb5490b5f69), [`b89635e`](https://github.com/kimjh96/flemo/commit/b89635eb83ca3b685b61c0c03fdd85294e82f684)):
  - @flemo/core@1.29.0

## 1.12.6

### Patch Changes

- Updated dependencies ([`ab29846`](https://github.com/kimjh96/flemo/commit/ab29846347076b8c102e8acca6a95b859174a72c), [`a97af55`](https://github.com/kimjh96/flemo/commit/a97af5544dc6cb426a9daf8868af5cd7b11b2903), [`c987660`](https://github.com/kimjh96/flemo/commit/c987660617927cdcfbc733e5b8cf4fe67bd707fd), [`e093b50`](https://github.com/kimjh96/flemo/commit/e093b50d19e7c3e526f44c2a6b29f9ceffa7bdfc)):
  - @flemo/core@1.28.1

## 1.12.5

### Patch Changes

- [`db0985b`](https://github.com/kimjh96/flemo/commit/db0985b6d5e81bf5a2cd0e24bba97b0176cd2844) Stop a screen scope from staying a compositor layer at rest. A promotion is also a stacking context, so a scope that kept one outlived its flight and silently outranked anything a consumer rendered inside the screen — an open bottom sheet came up under the shared tab bar and no z-index could answer it. Flight-time promotion is unchanged; it belongs to the engine, which demotes it a settle past the landing. `flemo:preraster=on` re-arms the rest promotion and `flemo:layers=resident` the resident layers, both now opt-in.
- Updated dependencies ([`db0985b`](https://github.com/kimjh96/flemo/commit/db0985b6d5e81bf5a2cd0e24bba97b0176cd2844), [`d30a03f`](https://github.com/kimjh96/flemo/commit/d30a03fb860a3850c2925c9f67dad5615a7d50ac)):
  - @flemo/core@1.28.0

## 1.12.4

### Patch Changes

- Updated dependencies ([`034a295`](https://github.com/kimjh96/flemo/commit/034a295aae17d2cb2a872b07666d6d570cec6753)):
  - @flemo/core@1.27.1

## 1.12.3

### Patch Changes

- [`fb4bb71`](https://github.com/kimjh96/flemo/commit/fb4bb71074f697435acfe8609b4073e2e2c4adc0) Key the two desktop defaults that are not about refresh rate on the desktop
  itself. The screen-scope layer promotion and `ScreenFreeze`'s hide debounce now
  read a new `isDesktopBlink` predicate instead of the learned steady-60 verdict:
  one is about how Blink treats an occluded layer, the other trades memory for
  raster, and neither reads the display. Desktop Chrome sessions get both from
  their first flight instead of after a two-flight cadence measurement, and a
  120Hz or 1x desktop is no longer excluded from defaults that never depended on
  its panel.
- Updated dependencies ([`cbb258d`](https://github.com/kimjh96/flemo/commit/cbb258da2b94456d3c7d31db6ab1bbada0ceb764), [`fb4bb71`](https://github.com/kimjh96/flemo/commit/fb4bb71074f697435acfe8609b4073e2e2c4adc0), [`e89b3e7`](https://github.com/kimjh96/flemo/commit/e89b3e776722ea972250c5fe4af91083ba33a643), [`c0232a9`](https://github.com/kimjh96/flemo/commit/c0232a940c614b6442b63b8abf61ba8d86a94adf), [`b786a0b`](https://github.com/kimjh96/flemo/commit/b786a0b9a5fa81b19ab38b6f77e0d7149eca5d81)):
  - @flemo/core@1.27.0

## 1.12.2

### Patch Changes

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
- Updated dependencies ([`6b1bb93`](https://github.com/kimjh96/flemo/commit/6b1bb93383221c29ba0d630123ca60a7b8f16d30), [`d6dab7f`](https://github.com/kimjh96/flemo/commit/d6dab7f398024dd3f9cae885aba9dfa73b48dda6), [`9d706dc`](https://github.com/kimjh96/flemo/commit/9d706dcda42aacc4d15262dd76fbe7821a52d541), [`9685d02`](https://github.com/kimjh96/flemo/commit/9685d020fea2e6f87ee7893a6b3d616cd8cc26bd)):
  - @flemo/core@1.26.0

## 1.12.1

### Patch Changes

- Updated dependencies ([`445e116`](https://github.com/kimjh96/flemo/commit/445e1163cf3b53d31b3b3cd0e19856bcd237aa9e)):
  - @flemo/core@1.25.1

## 1.12.0

### Minor Changes

- [`55d4fc5`](https://github.com/kimjh96/flemo/commit/55d4fc57ae4ab0d585a1887a6952026f769390a9) Let a navigation choose which Router it runs on. Give a `<Router>` a `name` and target it
  from anywhere inside it: `useNavigate({ router: "app" })` binds every call, and
  `push(path, params, { router: "app" })` overrides per call, alongside the relative targets
  `current`, `parent`, `root` and `nearest-owner`. A nested Router's screen can now open a
  full-screen route on the Router above it instead of transitioning inside its own `Slot`,
  with the selected Router's history, transition and gestures driving from the first frame.
  Router names are type-checked through a `RegisterRouter` augmentation, the same way routes and
  transitions are: register them and an unknown `router` target becomes a compile error, leave the
  registry empty and any name still works. Navigating to a route the target Router does not declare is now reported in development
  (an error for an explicit target, a warning otherwise, or an error everywhere with the new
  `strictRoutes` prop) instead of silently producing an empty transition.

### Patch Changes

- [`fb09af3`](https://github.com/kimjh96/flemo/commit/fb09af3b9c8b153ccfb12190ce55c460a67ef3b9) Publish `<Router defaultTransitionName>` at commit instead of during render. A render React
  throws away (a transition that suspended) used to push its default into the live store anyway,
  so a navigation from the screen still on display could play a transition the committed props
  never asked for. The write is also skipped when the value has not changed, so subscribing to the
  transition store no longer wakes on every single commit.

## 1.11.1

### Patch Changes

- [`c2aa749`](https://github.com/kimjh96/flemo/commit/c2aa749a4064ebe68f22bc2ad4e7f8f88c0d41bb) Fix a React hydration mismatch on server-rendered screens: the scope's
  `will-change: transform` promotion is derived from browser-only state
  (`flemo:preraster`, the steady-60 desktop profile), so it is now deferred past
  hydration instead of being evaluated in the hydration render — the server HTML
  and the first client render always agree, and the promotion still lands before
  any transition can start. Core exports `readLayerPromotionFlag`, the single
  predicate both halves of that decision now read.
- Updated dependencies ([`c2aa749`](https://github.com/kimjh96/flemo/commit/c2aa749a4064ebe68f22bc2ad4e7f8f88c0d41bb)):
  - @flemo/core@1.25.0

## 1.11.0

### Minor Changes

- [`30c2a54`](https://github.com/kimjh96/flemo/commit/30c2a5428e3561aa0d43295df852031c02975e39) Add optional shared top and bottom bar IDs so only semantically matching bars hand over in place. Reuse matching partner measurements and synchronously reserve newly measured bar heights before paint, while retaining the legacy position-only behavior when IDs are omitted.

- [`b495c99`](https://github.com/kimjh96/flemo/commit/b495c99651e2eb73f720d2f802525b538a782c95) Scope the image-decode offloader to legacy Android Blink instead of running it on every device. A touch Chromium that ships no UA-CH brands (device-confirmed Galaxy Note 9 Samsung Internet) is confidently pre-2021, GPU-starved hardware whose oversized-image decode stalls the transition opening on re-entry; the offloader now auto-engages there and downscales only its genuinely oversized `<img>` sources. Modern devices (which ship UA-CH brands) and iOS are excluded, so a flagship is never touched, and `flemo:imgoffload` still overrides both ways (`on` forces it anywhere, `off` opts a legacy device out). Exposes `isLegacyAndroidBlink` from `@flemo/core`.

- [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541) Close the release race that intermittently froze flights mid-motion on desktop Chrome: the hold release now reconciles React state in the same task as the readiness rAF (flushSync), so an interleaved commit can no longer write the stale paused hold attribute over a running animation. The render-settle gate also arms on a pop's returning screen (its landing-storm commits are node-light and slipped the mount-sized threshold), and a covered screen's Activity freeze is debounced past the natural browse rhythm so a quick detail-and-back never pays the hide/unhide raster thrash mid-flight.

### Patch Changes

- [`cec6ab6`](https://github.com/kimjh96/flemo/commit/cec6ab66d6334fe8203ea304fe496ff6849fa559) Remove dead diagnostic instrumentation (the write-only `window.__flemoRoute`/`__flemoOpenings`/`__flemoSeam`/`__flemoHandoffs`/`__flemoParked` globals and the unused `flemo:compiled` and `flemo:native` toggles) and consolidate the surviving `flemo:*` debug flags into one documented registry (`diagnosticFlags.ts`). No behavior change — every shipped default, storage key, and per-page-load caching contract is preserved, and `window.__flemoPlayerGaps` keeps working.

- [`fca7692`](https://github.com/kimjh96/flemo/commit/fca7692bfccdb9d3e5a9cd89ecdb97d99640ad80) Emit `data-flemo-router` only after hydration so the router marker can't cause a hydration mismatch. The id comes from `useId`, whose value encodes the component's position from the hydration root; a consumer whose server render root differs from its client hydrate root (e.g. SSR renders `<Html><App/></Html>` but the client hydrates just `<App/>` at `#root`) produces a different id on each side, surfacing as a mismatch on the one flemo attribute that reaches the DOM. The engine only reads the attribute client-side, so it is now withheld until mount — server and first client render both emit nothing (a match), and an effect exposes it once hydrated.

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

- [`6d6dae8`](https://github.com/kimjh96/flemo/commit/6d6dae8f98b159d3faa5b0b57a637288fffc6c53) Keep transition-adjacent scrolling responsive and reject cross-axis touch jitter before page-wide swipe-back can claim or cancel into an unintended pop.

  During push and replace transitions, Flemo suppresses `click` activation for React handlers and native click listeners below the React root. Listeners above the root, plus lower-level pointer and mouse events, remain observable so the browser can preserve native scroll targeting across the transition.

- Updated dependencies ([`30c2a54`](https://github.com/kimjh96/flemo/commit/30c2a5428e3561aa0d43295df852031c02975e39), [`9b16d8f`](https://github.com/kimjh96/flemo/commit/9b16d8fcd5b267b0e8865001c8db505be56814cf), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`cec6ab6`](https://github.com/kimjh96/flemo/commit/cec6ab66d6334fe8203ea304fe496ff6849fa559), [`0473551`](https://github.com/kimjh96/flemo/commit/0473551b5911d203ae7984ba53623baa6268396b), [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745), [`b495c99`](https://github.com/kimjh96/flemo/commit/b495c99651e2eb73f720d2f802525b538a782c95), [`20744c0`](https://github.com/kimjh96/flemo/commit/20744c0f2ed1bcfd8d50a5c4b6c9fb52bc7d9226), [`945eaba`](https://github.com/kimjh96/flemo/commit/945eabace0200a7693271e9433e28da62f2e848a), [`88c5cff`](https://github.com/kimjh96/flemo/commit/88c5cff30f3edd580b4a52513e287aa1c082882f), [`14923eb`](https://github.com/kimjh96/flemo/commit/14923eb8d7f6c9c3574d8c95db606ff190b2ca54), [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745), [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9), [`2be1e05`](https://github.com/kimjh96/flemo/commit/2be1e05a6d18883830edeaffbe5db7d724ebb204), [`6d6dae8`](https://github.com/kimjh96/flemo/commit/6d6dae8f98b159d3faa5b0b57a637288fffc6c53), [`6d3cc23`](https://github.com/kimjh96/flemo/commit/6d3cc238755a1a7d2d25edbf9113ea7c27fc571e), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`bfd077a`](https://github.com/kimjh96/flemo/commit/bfd077a0b67181da88f73d46ccadcff73b7ff65d), [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9)):
  - @flemo/core@1.24.0

## 1.10.0

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

### Patch Changes

- Updated dependencies ([`490b0e4`](https://github.com/kimjh96/flemo/commit/490b0e420429b828011c7092c549f52258beae80)):
  - @flemo/core@1.23.0

## 1.9.0

### Minor Changes

- [`0c721b8`](https://github.com/kimjh96/flemo/commit/0c721b8c27bea2d895f855a1a8384ccc42a87c97) Start a cold push's motion immediately: the content-settle gate no longer holds the entry until data lands, removing the ~300ms-plus tap-to-motion delay on skeleton screens. The stall re-anchoring and clock-cap machinery shipped since the gate was introduced bounds a mid-flight data commit to at most a two-frame hold, verified jank-free on device with the gate off. The framework-neutral gate (`contentSettle`) remains available in @flemo/core for bindings that prefer the arrive-complete trade.

### Patch Changes

- Updated dependencies ([`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e)):
  - @flemo/core@1.22.1

## 1.8.2

### Patch Changes

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Split the screen-freeze decision into three modes (`computeScreenFreezeMode`): a DEEP screen (below the direct prev) freezes in the same commit that re-ranks it, only the just-covered screen's freeze keeps the quiet-window deferral, and participants wake immediately. Deferring deep freezes let a rapid push storm accumulate 15-20 live full-screen layers (no quiet window ever arrived), flickering and janking the whole app at depth — a regression introduced with the freeze deferral.

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Scope navigation-status updates to the screens that actually participate: parts and decorators inside a resting deep screen pin their status subscription to a constant (the screen scope already did), and a nested Router composes the enclosing screen's resting flag down so a covered outer screen's inner-active chrome pins too. One navigation now flips a depth-independent constant number of nodes (measured: 18 nodes at depth 15 before, 3 after) instead of re-rendering and re-stamping every stacked screen's decorator and parts.
- Updated dependencies ([`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0)):
  - @flemo/core@1.22.0

## 1.8.1

### Patch Changes

- Updated dependencies ([`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e), [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e), [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e)):
  - @flemo/core@1.21.1

## 1.8.0

### Minor Changes

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Enter complete on pushes: a freshly-mounted PUSH destination whose requests are still in flight waits (bounded) for its first content wave to land and settle before the motion starts, so a cold navigation slides in already filled instead of assembling mid-flight. Replaces (bottom-tab switches), warm entries, and pops pay nothing.

### Patch Changes

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Defer the covered screen's freeze commit 600ms past the convergence instead of applying it at the COMPLETED flip. The freeze disconnects the covered screen's whole effect tree in one large commit; landing it while the eye watches the transition settle was measured (paired on-device A/B) as the remaining convergence frame drops. The screen is already covered, so freezing late is invisible; a new transition re-arms the timer so the commit only lands in a quiet window. Unfreezing stays immediate.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Pre-warm the compositor while the user interacts. The per-flight warm-up starts with the flight, so the first navigation after an idle period still paid the pipeline's wake-up inside its opening frames. The warm-up now rides any interaction (pointer movement, wheel, touch, keys) — a pointer moving toward a tap precedes it by seconds — renewed at a throttled cadence and released shortly after interaction stops.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Warm the compositor for the length of every flight and decode oversized images off the main thread. Fixes the one-frame opening judder on cold transitions and the WebKit tab fade being swallowed when a fetching screen's image decode lands inside the flight.
- Updated dependencies ([`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f)):
  - @flemo/core@1.21.0

## 1.7.2

### Patch Changes

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Keep the convergence frames light. Resting screens deeper than the transition pair no longer re-render on status flips (previously an O(depth) re-render plus attribute-write storm landed exactly on the final frames of every navigation), and the in-flight landing now presents two frames after COMPLETED instead of inside the convergence commit — with an immediate land if a new navigation starts first.
- Updated dependencies ([`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6)):
  - @flemo/core@1.20.0

## 1.7.1

### Patch Changes

- [`d979a33`](https://github.com/kimjh96/flemo/commit/d979a33db7642e70bb3687cd12593b789c7dcc39) Revert the shell-first children deferral and re-anchor the transition gate to the motion start. Screens enter with their real content in the first frame again — no blank shell, no late content pop-in, no perceived double render. A heavy mount commit now delays the transition start by exactly its cost instead of snapping the transition away: the gate backstop re-arms while the hold is pending and restarts with a full window when the motion actually begins.
- Updated dependencies ([`d979a33`](https://github.com/kimjh96/flemo/commit/d979a33db7642e70bb3687cd12593b789c7dcc39)):
  - @flemo/core@1.19.1

## 1.7.0

### Minor Changes

- [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8) Start transitions against the screen shell: a screen mounting into a push or replace now renders its frame first and mounts consumer children in a deferred commit once the transition's first frame has painted, so heavy content can no longer freeze or swallow the animation. The rAF player also re-anchors its clock across long main-thread stalls, resuming motion instead of fast-forwarding to the end. `@flemo/core` gains a `shouldMountShellFirst` export so the shell-first decision stays framework-neutral, a new public API that lifts core to a minor bump.

### Patch Changes

- [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8) Fix nested Router key collisions across nesting levels: a nested Router now chains its parent Router's key into its own history-state key. Previously two nesting levels both sitting on their root entries derived the same key, and the scope-persistence registry handed the inner Router the outer Router's stores, so one push navigated both levels at once.

- [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8) Fix `<Part>` to read its status from the Router that owns its screen. A Part placed in a nested Router's chrome previously followed the inner Router's transitions instead of its enclosing screen's, so it never animated with the outer navigation.
- Updated dependencies ([`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8)):
  - @flemo/core@1.19.0

## 1.6.9

### Patch Changes

- [`c2ddae3`](https://github.com/kimjh96/flemo/commit/c2ddae3e4ea6ade5cc5ee2c9651c152bb2f2232d) Survive browser-cancelled transition animations on every participant: when a mid-transition commit makes WebKit silently cancel a running screen, decorator, bar, or part animation, the engine now resumes it on its original timeline (negative-delay rejoin) instead of losing the exiting screen's fade or cutting the whole transition to a single-frame swap after one retry.
- Updated dependencies ([`c2ddae3`](https://github.com/kimjh96/flemo/commit/c2ddae3e4ea6ade5cc5ee2c9651c152bb2f2232d)):
  - @flemo/core@1.18.1

## 1.6.8

### Patch Changes

- [`4214525`](https://github.com/kimjh96/flemo/commit/4214525eba426cf29c3f00adeb404126c9cd6b67) Pair-release the anim-hold for every navigation (push and replace included, not just pop), scope the image-decode wait to screens actually waking from a freeze so the pairing costs nothing, and teach the transition engine to recover a cancelled screen animation (restart once, then a duration-based watchdog) instead of hanging until the 1.2s task gate and snapping with no transition.
- Updated dependencies ([`4214525`](https://github.com/kimjh96/flemo/commit/4214525eba426cf29c3f00adeb404126c9cd6b67)):
  - @flemo/core@1.18.0

## 1.6.7

### Patch Changes

- [`980af25`](https://github.com/kimjh96/flemo/commit/980af254371f322d1a7bdbbc657d449e6be464ed) Release the anim-hold of both screens of a pop together: a transition-scoped barrier (`createAnimHoldCoordinator`) waits for the pair's slowest readiness gate, so the revealed screen's image-decode wait no longer lets the exiting screen start first and the pop pair always moves on one clock, still bounded by the existing 300ms backstop. Push and replace timing is unchanged.
- Updated dependencies ([`980af25`](https://github.com/kimjh96/flemo/commit/980af254371f322d1a7bdbbc657d449e6be464ed)):
  - @flemo/core@1.17.0

## 1.6.6

### Patch Changes

- Updated dependencies ([`15ab16b`](https://github.com/kimjh96/flemo/commit/15ab16b5c2dc0e8b015f965c8871358a9fc26532)):
  - @flemo/core@1.16.1

## 1.6.5

### Patch Changes

- Updated dependencies ([`39bc7ea`](https://github.com/kimjh96/flemo/commit/39bc7eab906cb785a50405be7ea7438f0e6c4293)):
  - @flemo/core@1.16.0

## 1.6.4

### Patch Changes

- Updated dependencies ([`1a21cfc`](https://github.com/kimjh96/flemo/commit/1a21cfc94a8a01fba0e920fa179e67e4d0d84448)):
  - @flemo/core@1.15.0

## 1.6.3

### Patch Changes

- Updated dependencies ([`8236d28`](https://github.com/kimjh96/flemo/commit/8236d28865712207b02b5b701bbb9aab6f6405af)):
  - @flemo/core@1.14.0

## 1.6.2

### Patch Changes

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Pre-rasterize the PUSH-entering screen during the anim-hold ("park-under"): a screen entering from fully off-screen has no rasterized tiles, and Chromium then rasterizes them as the slide reveals — on raster-heavy content that froze a presentation frame mid-motion (a visible "tick"). The entering screen now parks at its destination beneath the previous screen for the hold window (container-level stacking demotion, gated on that screen's verifiably opaque surface, with the paused hold as fallback) and then replays its animation over the already-rasterized layer. Also restores the decode-wait wiring in the React binding — the scope was accidentally dropped in a refactor, shipping the image decode-wait dormant.

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Drive transition motion with a single-timeline rAF player instead of compiled CSS animations. Chromium's compositor-driven animations (CSS keyframes and WAAPI alike) intermittently miss presentation deadlines on raster-heavy layers — invisible to every JS metric and unfixable from CSS — while main-thread-driven transforms stay smooth (screen-recorded, single-variable A/B). All participants of one navigation (entering and exiting screens, dim decorator, riding bars) now step off one shared clock, x/y values snap to device pixels while moving at least one device pixel per frame (crisp leading edge without the compositor's erratic snapping) and glide unsnapped below that speed (snapping sub-pixel motion quantizes it into the end-of-transition shivering), and the anim-hold/park/decode pipeline gates the start exactly as before. Variants the player cannot provably interpolate (mismatched value templates such as clip-path morphs) keep the compiled CSS animation path unchanged, and a device whose main thread chronically starves the player (measured by its own frame gaps) earns a persisted demotion back to the CSS path — the library observes and decides; there is no consumer API.
- Updated dependencies ([`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713)):
  - @flemo/core@1.13.0

## 1.6.1

### Patch Changes

- [`1d2edf0`](https://github.com/kimjh96/flemo/commit/1d2edf012f5030fa8c834a59c9c49ee500d8a30f) Make rapid and cross-zone back/forward bulletproof. Transition-gated tasks now carry a gate backstop, so a transition whose `animationend` is lost (screen frozen or torn down mid-storm) can no longer deadlock the navigation queue. The history sync gains a convergence pass that replays the browser's present entry through the normal classifier once traversals go quiet, so the content always reaches the URL. A traversal landing multiple entries below replays each screen as its own transition instead of dropping the ones in between. Transition definitions are reference-counted, so a frozen Router instance cleaning up no longer strips the definitions a sibling zone is still animating with (the "screens stop transitioning until something remounts" bug). And a nested Router's scope AND history sync now persist for the session across zone exits: a zone that is offscreen still hears traversals and applies them instantly, so it is already on the right entry whenever it is revealed — re-entering a zone resumes animated navigation instead of degrading to instant restores. A nested Router's URL-reflection is also fenced to its own zone: an effect flushing after the browser has already traversed to a foreign entry (backing to home mid-storm) can no longer rename that entry to the zone's seed URL — the permanent "address bar says one zone, screen shows another" corruption.
- Updated dependencies ([`1d2edf0`](https://github.com/kimjh96/flemo/commit/1d2edf012f5030fa8c834a59c9c49ee500d8a30f)):
  - @flemo/core@1.12.1

## 1.6.0

### Minor Changes

- [`2553ce0`](https://github.com/kimjh96/flemo/commit/2553ce036c6656ee89317ebec6d6c83c8d28050c) Remove the translateZ(0) content isolation and the `<Layer>` component. The isolation targeted a WebKit stall whose real cause was the animation-start anchoring (fixed by `data-flemo-anim-hold`); with the anchor in place, isolated and non-isolated runs measure identical on WebKit and identical-or-better on Chrome frame telemetry. Without the transformed box there is no containing block trapping `position: fixed` overlays, so `<Layer>` — which existed only as the escape hatch — is gone too: a plain fixed overlay inside screen content now works directly, rides transitions with the screen, and stacks with ordinary z-index.

## 1.5.8

### Patch Changes

- Updated dependencies ([`51c9eac`](https://github.com/kimjh96/flemo/commit/51c9eacf9afcf68dcc1731e3d7fee5b443e7d9e6)):
  - @flemo/core@1.12.0

## 1.5.7

### Patch Changes

- [`bce265d`](https://github.com/kimjh96/flemo/commit/bce265d3e4b50823d3f557872e052ced5b4a72fe) Make history synchronization identity-based and convergent, fixing the duplicate-screen crash and skipped transitions under rapid back/forward. Traversals now classify by entry identity (entries we hold pop with their animation, gap jumps included) with browser-space frame stamps for direction; queued events coalesce to the browser's present entry so storms collapse into one converging transition; and queued in-app navigations align the stack to the entry the user actually saw (and abort entirely when their Router has since unmounted) before acting. Verified by a randomized convergence property test against a browser-history model.
- Updated dependencies ([`bce265d`](https://github.com/kimjh96/flemo/commit/bce265d3e4b50823d3f557872e052ced5b4a72fe)):
  - @flemo/core@1.11.0

## 1.5.6

### Patch Changes

- [`3580635`](https://github.com/kimjh96/flemo/commit/3580635dabf45d9ce23743ff17440750e4bc9ffe) Keep the screen and the URL in lockstep under rapid back/forward traversals across a nested Router boundary. A traversal task whose Router unmounted before it ran now aborts instead of deadlocking the shared navigation queue; a nested Router derives its history-state key from its enclosing screen's entry id so a remount can read the frames its previous incarnation wrote; a traversal that cannot be faithfully classified adopts the entry without a transition instead of ignoring it; and a remounted Router no longer renames a history entry the browser had already moved past.
- Updated dependencies ([`3580635`](https://github.com/kimjh96/flemo/commit/3580635dabf45d9ce23743ff17440750e4bc9ffe)):
  - @flemo/core@1.10.1

## 1.5.5

### Patch Changes

- [`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586) Protect transitions from image re-decode and reveal-raster jank, whatever assets a consumer uses. A frozen screen's decoded images are discarded by the browser; the anim-hold release now waits (bounded) for the entering screen's images to re-decode, a covered screen entering on pop parks at its destination during the hold so its tiles pre-rasterize (gated on the covering screen's background being opaque, with the paused hold as fallback), and every unfreeze eagerly re-decodes the screen's images so a swipe reveal — which no hold can cover — starts warming immediately.
- Updated dependencies ([`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586)):
  - @flemo/core@1.10.0

## 1.5.4

### Patch Changes

- [`40d8584`](https://github.com/kimjh96/flemo/commit/40d8584c75291b96b10a3cda59c93d40acc3209c) Finish the framework-neutralization pass: `resolveTransition` (name → registered transition with the `none` fallback) and `subscribeStepParamsRestore` (step-frame param restore on back/forward) move into `@flemo/core`, and the React binding delegates to them. No behavior change.
- Updated dependencies ([`40d8584`](https://github.com/kimjh96/flemo/commit/40d8584c75291b96b10a3cda59c93d40acc3209c)):
  - @flemo/core@1.9.0

## 1.5.3

### Patch Changes

- [`4e54577`](https://github.com/kimjh96/flemo/commit/4e545777a41fa1dac7b23aba193cc85f3cf73c7f) Move every framework-neutral piece of the React binding into `@flemo/core` so future bindings (Svelte, Solid) reuse it: `createStepController` (step push/replace/pop orchestration), `createRouterScope` (store-bundle creation/seeding, with the `FlemoStores` type), `buildRoutePath`, `matchesPathname`, `enteringInitialStyle`, `registerTransitionDefinitions`, `observeBarHeight`, and `observeViewportScrollHeight`. `@flemo/react` now delegates to them with no behavior change.
- Updated dependencies ([`4e54577`](https://github.com/kimjh96/flemo/commit/4e545777a41fa1dac7b23aba193cc85f3cf73c7f)):
  - @flemo/core@1.8.0

## 1.5.2

### Patch Changes

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Anchor a transition's start to the screen's first painted frame. iOS WebKit starts the animation clock when the style commits, so a heavy entering screen (large list, fetch-on-mount) burned the opening of the transition rasterizing its first frame and the animation visibly skipped ahead; the animation is now held paused for the first two frames and then plays its full duration against already-painted layers.

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Fix a shared bar riding a frame behind its screen on browser-back navigation. `data-flemo-bar-riding` is now computed in render and committed alongside the bar's status, so the bar starts its keyframe in the same frame as the screen for any transition and any trigger (a programmatic `pop` or the browser back button). The internal `driveBarRiding` engine helper is replaced by the pure `computeBarRiding`.
- Updated dependencies ([`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19), [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19)):
  - @flemo/core@1.7.0

## 1.5.1

### Patch Changes

- Updated dependencies ([`7513f82`](https://github.com/kimjh96/flemo/commit/7513f82eac7788d7c49ba57efd248a60b4d906f2)):
  - @flemo/core@1.6.1

## 1.5.0

### Minor Changes

- [`f04a8d1`](https://github.com/kimjh96/flemo/commit/f04a8d17c587d7ab930e548a45497d63fa85bf95) Add `<Layer>`: lift an overlay (bottom sheet, dim backdrop, FAB, toast) out of a screen's content-isolation box up to the scope level, so it floats over the screen and rides the transition instead of being trapped (and flashed mid-transition) inside the inset, scrollable content box. Put it inside a reusable overlay component once and every call site gets the escape for free; outside a `<Screen>` it renders in place. This resolves the backdrop / overlay / WebKit trilemma: the content layer keeps `backdrop-filter` working while overlays escape via `<Layer>`.

- [`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13) A `<Router>` nested inside another is now a local transition region: it runs its own in-memory history (no browser back/forward, no URL change) and contains its screens to its box via `position: absolute`, so only that region transitions while the surrounding layout (sidebars, headers) persists. A root `<Router>` is unchanged.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Let a Router run on a custom history backend. Router accepts a `createDriver` factory, and HistoryDriver gains `readPathname()`, so the Router reads and writes the URL only through its driver. A wrapper (e.g. a locale-aware driver that keeps a `/ko` prefix in the address bar while the Router matches unprefixed paths) can now own the whole URL surface without the Router touching window.location directly.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add a per-Router `history` prop (`"browser"` default, `"memory"` opt-in) that decouples the history backend from nesting. A nested `<Router>` now participates in browser back/forward by default, while `history="memory"` keeps its previous isolated in-memory stack. Browser Routers namespace their `window.history.state` by a stable key and use a per-Router self-pop guard so multiple browser Routers coexist without clobbering each other.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Freeze inactive screens with React's `<Activity>` instead of a manual
  display:none wrapper. Hidden screens keep their DOM state (scroll position, form
  values, media) and restore it when shown again, while their effects now suspend
  while hidden and remount on show, so timers and subscriptions no longer run on
  screens the user can't see. Requires React 19.2+.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add `usePathname`, a public hook that returns the active pathname reactively. It lets chrome rendered outside a `<Screen>` (a header or sidebar) highlight the current route without reaching into the stores.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) `useStep` now works outside a `<Screen>`, so persistent UI like a header menu or a sidebar can drive a history-backed step that the Back button closes. Pass the param type for inference (`useStep<{ menu: boolean }>()`); inside a `<Screen>` it behaves exactly as before.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Rename the `Screen` bar props to position-based, platform-neutral names: `appBar` to `topBar`, `navigationBar` to `bottomBar`, `sharedAppBar` to `sharedTopBar`, `sharedNavigationBar` to `sharedBottomBar` (the exported `SharedBarPresence` fields rename to match). Behavior is unchanged. This is a breaking rename: update any `Screen` that sets these props. The old `navigationBar` was easy to misread since it means the top bar on iOS and the web, while flemo uses it for the bottom one.

- [`f9f0214`](https://github.com/kimjh96/flemo/commit/f9f02140b091903ffa9f7a64494a5c1d8d56b084) Add `<Slot>`: mark where the screen stack renders inside a layout. Put your `<Route>`s in a `<Slot>` and lay the rest of the screen (sidebar, header, footer) around it. Only that region transitions between routes while everything outside it persists. It stays one `<Router>`, one history, one `navigate`, so a sidebar's `useNavigate` drives the region with no extra wiring.

### Patch Changes

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Make usePathname report a pop's destination immediately, consistent with push. The history store tracks a `pendingIndex` that advances to the target as soon as a pop starts (the render index still lags on the leaving screen until the transition resolves), and usePathname reads it. A browser Back no longer leaves chrome (active nav highlight, breadcrumbs) on the old route until the back animation finishes.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) `Router` now splits a query off `initPath` (such as `/playground/1?code=x`) and seeds the matched route's params from it, so a deep link or refresh renders the right step state on load. A plain `initPath` with no query is unchanged.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Fix useStep losing the screen's params in a keyed browser Router (a nested Router, or more than one Router on the page). pushStep/popStep and the step param restoration now go through the Router's own driver and self-pop guard, so closing a step (close button or browser Back) returns to the screen it was opened from instead of resetting to the first one. A deep-linked screen now seeds its params into the history frame too.
- Updated dependencies ([`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13), [`9937291`](https://github.com/kimjh96/flemo/commit/993729187939f96122381cd740343a7a8878efc1), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912)):
  - @flemo/core@1.6.0

## 1.4.2

### Patch Changes

- [`e316444`](https://github.com/kimjh96/flemo/commit/e316444d3327df09569cd4568eb697878da85bff) Keep consumer `backdrop-filter` rendering during transitions. The content-isolation layer now promotes with `transform: translateZ(0)` instead of `will-change: opacity`, so a frosted header inside a screen no longer washes out mid-transition.

## 1.4.1

### Patch Changes

- [`080024f`](https://github.com/kimjh96/flemo/commit/080024f7daa158c4ed36ba25d516eaaa04908aa5) Fix consumer `position: fixed` overlays (e.g. bottom sheets) jumping or flashing across the screen during transitions. The content layer is now promoted with `will-change: opacity` instead of a transform, so it no longer establishes a containing block that re-parents those overlays into the scrollable content box mid-transition. Overlays stay pinned to the screen and ride the transition cleanly.

## 1.4.0

### Minor Changes

- [`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1) Add progress-driven part transitions. `createPartTransition` defines a named, status×active animation for a single element (any CSS property), and `<Part name="...">` runs it on that element anywhere inside a screen: an app/navigation bar child, body content, anything. Programmatic transitions play on the compositor with no React re-render, and the same definition follows the swipe-back drag inline. Register the transitions through the `Router`'s `partTransitions` prop. `createRawPartTransition` gives full per-variant control.

### Patch Changes

- Updated dependencies ([`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1)):
  - @flemo/core@1.5.0

## 1.3.2

### Patch Changes

- [`05cc7eb`](https://github.com/kimjh96/flemo/commit/05cc7eba37ede2ca088c1ea73116a9b99388f7f6) Fix transitions skipping ahead on WebKit when a screen's content updates mid-transition (e.g. an async fetch resolving). The content is now isolated onto its own compositing layer while a transition is in flight, so the repaint no longer stalls the animating layer's presentation. Applies to every transition, including custom ones.

## 1.3.1

### Patch Changes

- [`343ea33`](https://github.com/kimjh96/flemo/commit/343ea3331ed5ac3f087fdf8fb0ed0a9ebf4c1062) Keep the shared app/navigation bar spacer height stable while a screen is frozen (`display: none`) during a transition. The ResizeObserver reports a height of 0 for the frozen screen; using it collapsed the spacer, and WebKit then clamped `scrollTop` to the smaller scroll range without restoring it on unfreeze, so short pages jumped on navigation. The measurement now ignores 0 and holds the last real height.

## 1.3.0

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
- Updated dependencies ([`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551), [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6)):
  - @flemo/core@1.4.0

## 1.2.0

### Minor Changes

- [`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f) `useNavigate().pop` now accepts a `transitionName` to override the back animation — handy when collapsing several screens with `skip` / `until`, where the leaving top's own transition isn't the one you want. The override is applied in the same commit that starts the pop, so the original transition never paints a frame.

### Patch Changes

- Updated dependencies ([`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f)):
  - @flemo/core@1.3.0

## 1.1.0

### Minor Changes

- [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef) `useNavigate().pop`, `replace`, and `push` now take an optional distance — `{ skip }` (a number of screens) or `{ until }` (a route pattern) — to reach a screen below the top in a single transition. The skipped screens are removed without ever painting, so they never flash by.

  All three reach the same target (`{ skip: n }` is the screen `n` below the top; `{ until }` is the nearest match) and differ only there: `pop` lands on it, `replace` replaces it (the target and everything above become the new screen), and `push` keeps it and stacks the new screen on top.

  `{ skip }` clamps to the stack depth; an unmatched `until` is a no-op for `pop`/`replace` and a plain push for `push`. Plain `pop()` / `replace(path)` / `push(path)` are unchanged.

### Patch Changes

- Updated dependencies ([`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056), [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056), [`6df7e4f`](https://github.com/kimjh96/flemo/commit/6df7e4fd5c3446771fbc9602d703273e75615af6), [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef)):
  - @flemo/core@1.2.0

## 1.0.6

### Patch Changes

- Updated dependencies ([`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79), [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79)):
  - @flemo/core@1.1.2

## 1.0.5

### Patch Changes

- [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93) Move `ScreenMotion`'s transition-lifecycle `animationend` listener (and the COMPLETED-branch inline-style cleanup) from `useEffect` to `useLayoutEffect`. The listener now attaches synchronously during commit, before the browser paints the first animation frame, closing a tiny race where a very short variant could finish before a post-commit `useEffect` attached. The pre-paint cleanup also means the browser never paints a transient frame with stale inline styles overlapping the rest CSS rule. Measurable cost in the production-ship configuration (with the compositor isolation hints active) is zero.
- Updated dependencies ([`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93)):
  - @flemo/core@1.1.1

## 1.0.4

### Patch Changes

- [`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2) Fix `createDecorator` so the decorator transition runs on the right screen. Previously every `*-true` variant (active side) and every `*-false` variant (inactive side) was forced through the two-state `enter` / `exit` pair: `IDLE-true`, `PUSHING-true`, `POPPING-true`, and `COMPLETED-true` all mapped to `enter`, while `PUSHING-false`, `REPLACING-false`, and `COMPLETED-false` all mapped to `exit`. That collapse meant the active side had to use one value for both "active at rest" and "the entering animation's target," which only worked if the two were identical — for the built-in `overlay` they were (`opacity: 0` for both), and the result was that no decorator animation was visible at all on the new screen entering or the previous screen going behind.

  `createDecorator` now takes a required `idle` separate from `enter` / `exit`, with three distinct roles:
  - `idle` — resting position. Held at IDLE-*, COMPLETED-true, POPPING-true, and the *new\* screen during PUSH / REPLACE (`PUSHING-true` / `REPLACING-true`). The entering screen lands here so its decorator stays invisible on top of the new active screen.
  - `enter` — target for the screen moving INTO the background. Used on `PUSHING-false` / `REPLACING-false` (peak) and `COMPLETED-false` (settled). For overlays this is the dim state — the previous screen darkens.
  - `exit` — target for the previously-behind screen returning to active on `POPPING-false`. Animates from `enter` (its prior settled position) toward `exit`. Match `exit` to `idle` to land softly on the active rest rule.

  The built-in `overlay` decorator picks the new mapping up natively, so cupertino's push now darkens the screen sliding behind (was statically mounted before) and pop now smoothly clears the dim as the previous screen returns. Authors who used `createDecorator` directly must add an `idle` argument; per-state control via `createRawDecorator` is unchanged.

- Updated dependencies ([`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2)):
  - @flemo/core@1.1.0

## 1.0.3

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.

- [`077cf72`](https://github.com/kimjh96/flemo/commit/077cf727bc41db8d6954b4aee331783ea035daba) Extend the active-settle defensive cleanup to this screen's shared bars. The previous patch ([[stale-inline-swipe-styles]]) cleaned `scopeRef` and `decoratorRef` when a screen finished settling as active, but the shared `appBar` / `navigationBar` refs were not in the cleanup set. The swipe-mirror writes inline `transform` / `opacity` / `filter` / etc. to bars in lockstep with the screen, and if any release path is missed (interleaved navigation, a partner whose ride-along path didn't finalize, an unusual transition-driver order) the bar would sit at the swipe-time position even after the owning screen settled as active — same symptom class as the screen bug, just on the bar. Now bars are stripped of their inline styles and `will-change` hint in the same useEffect that handles the screen, so the compiled CSS rest rule cleanly owns the bar at rest.
- Updated dependencies ([`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937)):
  - @flemo/core@1.0.2

## 1.0.2

### Patch Changes

- [`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350) Two-layer fix for stale inline swipe styles surviving a navigation cycle and resurfacing on a later visit. flemo keeps inactive screens mounted via `display: none` (`ScreenFreeze`), so any inline `transform` / `opacity` / `filter` / `backgroundColor` / etc. that a swipe handler wrote via `animateInline` outlives the original navigation. Because inline styles beat the compiled CSS rest rule (`animation-fill-mode: forwards`), the screen renders at the stale "previous-screen waiting" position when it next becomes active.

  First layer — make `clearInlineAnimation` actually clean what `animateInline` wrote: a per-element WeakMap tracks every property animateInline sets, and the default-branch cleanup now strips exactly that surface. Previously it only removed `transform` + `opacity`, leaking any other animated property (e.g., `filter` on a custom blur transition). Untracked elements still fall back to the transform + opacity pair for defensive behavior.

  Second layer — defensive cleanup in `ScreenMotion`: every time a screen settles as the active topmost screen (`status === "COMPLETED"`), strip leftover inline animation styles and the `data-flemo-skip-animation` marker on the scope and decorator. This catches stale state from any path — the swipe-commit branch (which intentionally leaves the screen at its final inline position), interleaved navigation mid-cancel, custom transitions, decorators, anything — without needing each path to remember to clean up.

- [`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350) Eliminate the one-frame lag between a screen and its riding shared bars during user-driven swipe drag. The previous swipe mirror was a `requestAnimationFrame` loop that read `getComputedStyle(scope)` and wrote the value back to each bar — but rAF runs in its own JS tick separate from the `pointermove` handler that just wrote the screen, so the bar's commit always landed in the next paint pass. On mobile and slower devices this trailed visibly even though push / pop transitions (compositor-driven via the keyframe sibling selector) were already pixel-perfect.

  The mirror is now synchronous. `animateInline` is wrapped at the swipe lifecycle boundary (`beginSwipe` / `continueSwipe` / `endSwipe`) and intercepts every write to `currentScreen` or `prevScreen`, mirroring it to whichever bars ride that screen in the SAME JS tick. There is no rAF, no `getComputedStyle` read, no second pass — the browser composites the screen and the bars in one paint commit.

  Two ride lists are captured at `beginSwipe`: the current screen's bars (mirrored when the swipe handler writes to `currentScreen`), and the previous screen's bars (mirrored when it writes to `prevScreen` — both cupertino and material drive both screens per swipe tick). The previous-side bars are found by querying the partner screen container directly, so the swipe-driver doesn't need to reach into the partner ScreenMotion instance. Without this two-list split, an app whose previous screen owns a shared bar the current screen doesn't (e.g., a tab bar on the home screen, hidden on a detail screen) would see that bar fail to follow the swipe at all.

  The `will-change` hint moves to swipe-start so the riding bars pre-promote to their own compositing layer before the first inline write, and is cleared on swipe-end (or on commit, before `history.back()`, so the layer can be discarded cleanly). On commit, the previous-side bars are also stripped of any inline styles the swipe wrote — those would otherwise shadow the compiled CSS rest rule when the previous screen settles as active.

## 1.0.1

### Patch Changes

- [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb) Compositor-synced shared-bar ride-along. The previous rAF mirror loop read `getComputedStyle(scope)` and wrote inline styles onto the bars every frame — a main-thread roundtrip that left bars trailing the screen by one composited frame, especially visible on mobile. The compiled transition rule now emits a sibling selector targeting `[data-flemo-bar][data-flemo-bar-riding="true"]` with the same `@keyframes` the screen uses, so the bar runs the same animation on the same compositor pass — zero JS in the loop, pixel-exact sync. The rAF path is retained narrowly for swipe-drag, where the screen itself is already main-thread inline-driven and there is no compositor advantage to chase.
- Updated dependencies ([`a6a3550`](https://github.com/kimjh96/flemo/commit/a6a35501ba640ed1cfa72e202fc4ef53cf487704), [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb), [`f3e8ac9`](https://github.com/kimjh96/flemo/commit/f3e8ac9dd909fabc11621f6bd29449c286fb3bda), [`04a03d9`](https://github.com/kimjh96/flemo/commit/04a03d985d5517d87d570ea8b696dbaee3ef334e)):
  - @flemo/core@1.0.1

## 1.0.0

### Major Changes

- [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616) - Stabilize the public API at 1.0.0. The screen / transition / navigate / store surfaces (Router, Route, Screen, useNavigate, useStep, useScreen, useParams, createTransition, createDecorator, TaskManger, history & navigate stores) are now SemVer-major versioned — future breaking changes go through an explicit major bump and a migration note in this changelog. `@flemo/react-layout` stays in `0.x` until its motion-free FLIP migration lands.

### Minor Changes

- [`1aef7de`](https://github.com/kimjh96/flemo/commit/1aef7de948d0a9edce6b48419558e468226c9eb4) - Switch screen transitions from Motion's JS-driven `animate()` to compiled CSS keyframes. Each registered transition is compiled once at mount into a `<style data-flemo>` tag and applied via `data-flemo-status` / `data-flemo-active` attributes, so push, pop, and replace animations run on the compositor and stop competing with React renders on the main thread. Heavy screens (large trees, Suspense suspends) no longer drop the first frames of their entrance animation. Swipe-back stays imperative: pointer events drive inline `transform`/`opacity` during the drag, then a short inline CSS transition settles the screen and the keyframe pipeline takes over on `history.back()`. Custom transitions keep the same `createTransition({ initial, idle, enter, ... })` shape — the swipe handler signature drops Motion's `PanInfo`/`DragControls` in favor of native `PointerEvent` and a `SwipeInfo` object with the same `offset`/`velocity`/`point`/`delta` fields.

- [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44) - Initial release of `@flemo/react` — the React bindings for flemo, replacing the previous `flemo` npm package. Contains `Router`, `Route`, `Screen`, `ScreenMotion`, `ScreenDecorator`, `ScreenFreeze`, the `useNavigate` / `useStep` / `useScreen` / `useParams` hooks, the `HistoryListener`, the `Renderer`, and the `useTransitionStyles` insertion-effect hook that injects the compiled keyframes. Depends on `@flemo/core` for framework-agnostic primitives — no motion peer dependency. Migration: anywhere you wrote `import { ... } from "flemo"` becomes `import { ... } from "@flemo/react"`, and `declare module "flemo"` becomes `declare module "@flemo/react"`. `LayoutScreen` and `LayoutConfig` moved to the new `@flemo/react-layout` package — install it (`pnpm add @flemo/react-layout motion`) only if you use `layoutId`-based shared-element morphs.

- [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335) - Restore coexistence with consumer overlays (bottom sheets, dialogs) that rely on `position: fixed` and z-index. The screen scope no longer establishes a containing block or stacking context at rest: identity transform targets compile to `transform: none`, and the screen wrapper uses `contain: layout style` instead of `contain: strict`. The shared app/navigation bar ride-along is now generic over every property a transition writes — `collectAnimatedProperties` is mirrored from scope to bar each frame — so authoring a custom transition with `opacity`, `filter`, or any other CSS property no longer leaves the bar out of sync.

- [`3a727cb`](https://github.com/kimjh96/flemo/commit/3a727cb2bf589147a1a7759a7a1f9e99b28d7926) - Fix consecutive `pop()` / `popStep()` calls running out of order. All screen navigation (`push`, `replace`, `pop`) and step navigation (`pushStep`, `replaceStep`, `popStep`) now serialize onto a single ordered queue and execute strictly in call order. Previously `pop()` and `popStep()` fired `window.history.back()` directly, which let the browser coalesce rapid back-traversals into one `popstate` and desync the stack.

- [`58c930b`](https://github.com/kimjh96/flemo/commit/58c930bfcd30874f072d2567d255d2e283fe08f6) - Isolate shared app and navigation bars from screen transitions. They now render outside the animated screen, so a transition's transform or opacity never affects them. When navigating to or from a screen that doesn't declare the same shared bar, the bar animates along with its own screen instead of staying pinned in place. Screen-level overlays that need to cover a shared bar should render in the browser top layer (`popover` / `<dialog>`).

### Patch Changes

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Emit `will-change` on each compiled transition's variant rule, derived from the exact set of properties the transition writes — whatever the author put in `initial` / variant `value`s. The hint applies while the variant's status selector matches (PUSHING/POPPING/REPLACING) and releases the moment status flips back to IDLE/COMPLETED, so the compositor layer is allocated only for the animation window. Shared bars riding along via JS mirroring receive the same per-transition property set. Sustained 60fps for any author-defined transition target, not just transform/opacity.

- Updated dependencies [[`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335), [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58)]:
  - @flemo/core@1.0.0
