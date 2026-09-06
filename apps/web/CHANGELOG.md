# @flemo/web

## 0.11.8

### Patch Changes

- [`f81b77b`](https://github.com/kimjh96/flemo/commit/f81b77b30214fe6c77df1606ac30b2b8edd60434) Give the hero's demo cards their separated pose in the markup itself. The two
  cards run one keyframe loop offset by half a cycle, but the offset was applied
  only by a client layout effect, so the served HTML gave both the same animation
  with the same absent delay: both sat at the keyframe's 0% pose, identical
  transform and identical z-index, stacked exactly on top of each other with the
  music card, later in DOM order, covering the wallet outright. The browser
  painted that and hydration threw the music card back in one frame, which read as
  the demo flickering and resetting on every refresh.

  Measured on the page, sampling every frame from before hydration: 12 of 287
  frames had the two cards sharing a pose, about 200ms of the wrong app in the
  hero. It is 0 of 258 now, and an end-to-end test samples the same way so the
  next regression is caught in the frames that are actually painted.

  The shared roll clock also starts on the first mount rather than at script
  evaluation, so the layout effect's re-anchor agrees with the pose the markup
  painted instead of moving it by however long the bundle took to run.

- [`687e40b`](https://github.com/kimjh96/flemo/commit/687e40bdda6f2a0ae0afac6fe757d71022d9cf92) Make the Morph docs describe the options that exist. The table listed `scale`
  and `anchor`, neither of which the API has: `scale` was implemented and withdrawn
  before it shipped, `anchor` never existed. It also gave `crossFade`'s default as
  0.12 where the runtime uses 0.55, described `radius` as interpolating
  "scale-corrected endpoints" when nothing is scaled, and left out `carry`
  entirely, which is the option the page's own "when the element IS the screen"
  section spends a paragraph describing.

  The table is now keyed by `Record<keyof MorphTransitionOptions, string>`, so
  renaming or dropping an option in core stops the site compiling instead of
  leaving the table quietly wrong. Verified by renaming one: both locales fail the
  typecheck, at the row.

## 0.11.7

### Patch Changes

- [`07275fc`](https://github.com/kimjh96/flemo/commit/07275fc97741b274c4c36f0477205b93f7b28127) Ship the devtools as a component. `@flemo/devtools/react` exports
  `<FlemoDevtools />`, and that is the whole wiring: leave it in the tree and ship
  it, because under the `production` export condition the same specifier resolves
  to a component that renders null and imports nothing. The production entry
  measures 42 bytes and is now held there by a bundle-size budget.

  It replaces an imperative shape that made every consumer learn too much. Mounting
  the panel and the readout by hand meant an effect, a dynamic import, a
  cancellation flag, two detach calls, and knowing which export condition resolves
  where. The first consumer to get that wrong was this project's own playground:
  reaching for `@flemo/devtools/force` to make the instrument exist in a production
  build put the real panel and readout straight back into a public chunk, because
  the specifier survives whatever guard is wrapped around it. The site now mounts
  `<FlemoDevtools />` unconditionally, and an end-to-end test asserts the built
  output mounts no devtools surface at all.

  The imperative `attachDevtoolsPanel`, `attachDevtoolsHud` and
  `attachFlightRecorder` are unchanged and stay the entry point for anything that
  is not React. `react` is an optional peer dependency, needed only for the new
  entry. `dist` gains `react.mjs` and `reactNoop.mjs`, and the package's watch mode
  now rebuilds every entry rather than only the first.

- Updated dependencies ([`07275fc`](https://github.com/kimjh96/flemo/commit/07275fc97741b274c4c36f0477205b93f7b28127), [`4dbd635`](https://github.com/kimjh96/flemo/commit/4dbd635250a46b61a08035232929b5c41e179827)):
  - @flemo/devtools@0.6.0
  - @flemo/core@2.3.1
  - @flemo/react@2.2.4

## 0.11.6

### Patch Changes

- [`c2473b8`](https://github.com/kimjh96/flemo/commit/c2473b81e3986e24599359f70f192ae9149782e5) Arm the devtools on the playground with `?devtools=on` instead of importing
  them unconditionally, and mount the on-device readout beside the panel so a
  device round has numbers on the glass instead of a console it does not have.
  The arming matters more than it looks: a plain import of `@flemo/devtools`
  resolves to its inert production entry, so wired the ordinary way the panel
  mounted nowhere in a production build, which is the only build the judging
  protocol accepts. The choice persists in `flemo:devtools` and `?devtools=off`
  clears it; a session that never asks loads nothing at all.

  Adds an end-to-end net for the swipe release: the dim has to read the screen
  rather than the finger when a drag comes back past its start, a committed
  release has to cross the screen as motion rather than in one frame, and one
  case drives the whole gesture with real touch events.

- Updated dependencies ([`29ce877`](https://github.com/kimjh96/flemo/commit/29ce877dc9de8115321023dde514e9b5f0861641), [`ecf196e`](https://github.com/kimjh96/flemo/commit/ecf196ea1e732834766f68d12623c53b10931d8b), [`c5bf427`](https://github.com/kimjh96/flemo/commit/c5bf42734ec7dcc596672b72adb0cbf66d5c327b)):
  - @flemo/devtools@0.5.0
  - @flemo/core@2.3.0
  - @flemo/react@2.2.3

## 0.11.5

### Patch Changes

- [`04a881d`](https://github.com/kimjh96/flemo/commit/04a881d542523cb7305ddf11c024177d88f5528b) Rework the Showcase page as a card grid: drop the app screenshots, give each app a self-contained card with its identity row, pitch, "how it uses flemo" note, languages, and store links, and close the grid with an invitation tile for the next app.

## 0.11.4

### Patch Changes

- Updated dependencies ([`d613c10`](https://github.com/kimjh96/flemo/commit/d613c1004c1bc57585b3c8ebc530954b8a4a10b1), [`4aab461`](https://github.com/kimjh96/flemo/commit/4aab46177e6e8c6ae7daafb5da6118358db8741c), [`d613c10`](https://github.com/kimjh96/flemo/commit/d613c1004c1bc57585b3c8ebc530954b8a4a10b1), [`e1097bb`](https://github.com/kimjh96/flemo/commit/e1097bbd8b84a60ffa57ab91129a092469b80470), [`29a2e58`](https://github.com/kimjh96/flemo/commit/29a2e58aa7f7d5bbadf36527ced529b21c02f825), [`eb5dfbd`](https://github.com/kimjh96/flemo/commit/eb5dfbd0fce54bfd463e6480244264637f008cc2), [`7bb89ee`](https://github.com/kimjh96/flemo/commit/7bb89eebbc4c21c2b785df11187bc608cf1b7b44), [`1ad7608`](https://github.com/kimjh96/flemo/commit/1ad76080088a1f23674b3fbd8fd28bc51c983079), [`39ae3dd`](https://github.com/kimjh96/flemo/commit/39ae3dd30dc5f7d9582f2c24d6f42a88ea7ef0b2), [`911e97c`](https://github.com/kimjh96/flemo/commit/911e97c30b0c5e72af4dd850784c08c2342f6294), [`8664957`](https://github.com/kimjh96/flemo/commit/86649576adb7bb1960df883972baed2e096bd2d3), [`63cde53`](https://github.com/kimjh96/flemo/commit/63cde53da338309e6a4aa139d255b71ec16e1c2c), [`5a7d4d4`](https://github.com/kimjh96/flemo/commit/5a7d4d460a0a20ca82a213464c77623978838653), [`50a1222`](https://github.com/kimjh96/flemo/commit/50a122244b8d1c7d99df7ec634933fc811984a0c), [`b0ac25d`](https://github.com/kimjh96/flemo/commit/b0ac25d862258bfc0dbd98f4313ceb2ea96fd239), [`495b181`](https://github.com/kimjh96/flemo/commit/495b181fb8544b94ffaf508390d130384fd3c639), [`64056ca`](https://github.com/kimjh96/flemo/commit/64056ca87d8c40d6df7889858e7cf7ca7aab3e7e), [`5ef2915`](https://github.com/kimjh96/flemo/commit/5ef2915d16d56e8ccacd947164b67ad93b42ebf9), [`5312fb3`](https://github.com/kimjh96/flemo/commit/5312fb3f309b8c0ec1d2f53ae4cb1b894a7b0c58), [`f0cdd43`](https://github.com/kimjh96/flemo/commit/f0cdd43274a75428c9656ef6ce1fa5bea0a8f595), [`8188ee4`](https://github.com/kimjh96/flemo/commit/8188ee4319656e84126c7644c8e71844c4dda1d6), [`5ed45c9`](https://github.com/kimjh96/flemo/commit/5ed45c9b04b245d7fb868566c2dc58da4407d67a), [`d7518a2`](https://github.com/kimjh96/flemo/commit/d7518a2bb576508b6ecb5263ec460c7218c27b55), [`37694bd`](https://github.com/kimjh96/flemo/commit/37694bdd6247bcc947d37745ca6e89015ae4514d), [`6335d3a`](https://github.com/kimjh96/flemo/commit/6335d3a08d9d77144723df6eaefebcd5a55c1840), [`bf30ff3`](https://github.com/kimjh96/flemo/commit/bf30ff39a9e317fd26f44ea48aab2cf88926d8aa), [`29a2e58`](https://github.com/kimjh96/flemo/commit/29a2e58aa7f7d5bbadf36527ced529b21c02f825), [`0eb4bf7`](https://github.com/kimjh96/flemo/commit/0eb4bf78261e7b0d43015c4c0ca0618f4951d6a1), [`85e66e2`](https://github.com/kimjh96/flemo/commit/85e66e2b4e34afe1235870b3c14cb3d171c704af)):
  - @flemo/core@2.2.2
  - @flemo/react@2.2.2
  - @flemo/devtools@0.4.0

## 0.11.3

### Patch Changes

- Updated dependencies ([`7594fca`](https://github.com/kimjh96/flemo/commit/7594fca26e2351cd2f4c80e258d403dc7593fedb), [`ba00e4b`](https://github.com/kimjh96/flemo/commit/ba00e4ba3f3023dbc7cfb7b1d10a5b147c228bc3), [`702fec3`](https://github.com/kimjh96/flemo/commit/702fec3aab535e1c89c5932f704fed2a252ac5f3), [`ba123f1`](https://github.com/kimjh96/flemo/commit/ba123f1d3b9364e279627455c4dbf1ad594eb86a), [`a477e51`](https://github.com/kimjh96/flemo/commit/a477e510ccdf18730a4a7ce4b86df3b6c80f9d66), [`ddb6d02`](https://github.com/kimjh96/flemo/commit/ddb6d02d1d28317726c1b51a7632f6bc2ac57aa8), [`8a8b56d`](https://github.com/kimjh96/flemo/commit/8a8b56dfc3e1cd83ae1d5e547f2307f714c277e6), [`6bdf48b`](https://github.com/kimjh96/flemo/commit/6bdf48b5077e87543541d8b43ef6f3b1c1faafaf), [`0cede61`](https://github.com/kimjh96/flemo/commit/0cede6143cb6db6ade0ffd476fd510477b8fe25d), [`f352397`](https://github.com/kimjh96/flemo/commit/f35239705bd12d133886c5459e8861147100d4cc), [`ddb6d02`](https://github.com/kimjh96/flemo/commit/ddb6d02d1d28317726c1b51a7632f6bc2ac57aa8), [`52078fb`](https://github.com/kimjh96/flemo/commit/52078fb80623140a62ed98d0185baff33502001f)):
  - @flemo/core@2.2.1
  - @flemo/devtools@0.4.0
  - @flemo/react@2.2.1

## 0.11.2

### Patch Changes

- [`54039f7`](https://github.com/kimjh96/flemo/commit/54039f7f2735a83b22f79937b1b67e774bc41032) Stop painting the docs navigation drawer while it is closed. It stayed in the paint tree behind an off-screen transform, which cost a 462ms main-thread block on every mobile entry into the docs.
- Updated dependencies ([`28d0377`](https://github.com/kimjh96/flemo/commit/28d03778381fbd5c761712cf8b827aaf0b60a23e), [`e0cb632`](https://github.com/kimjh96/flemo/commit/e0cb632d620e712e8407c8f850ed6019e7024142), [`8608b73`](https://github.com/kimjh96/flemo/commit/8608b73536c305d0410489f55aeb6834a4ab9849), [`472432c`](https://github.com/kimjh96/flemo/commit/472432c6e6c7c951975437fbedf9dc8530e92de2), [`429599d`](https://github.com/kimjh96/flemo/commit/429599d7ffc022467b9301184d6e746d9c1bada1), [`6975302`](https://github.com/kimjh96/flemo/commit/697530271edafea590ebf95e7ce3bfaf2a04cfb6), [`207444c`](https://github.com/kimjh96/flemo/commit/207444c2a9ddcf0705308a26fb56cf079488344f), [`82930e8`](https://github.com/kimjh96/flemo/commit/82930e8e4e3bb12838d21dd9ed3427d1d5c75443)):
  - @flemo/core@2.2.0
  - @flemo/react@2.2.0
  - @flemo/devtools@0.4.0

## 0.11.1

### Patch Changes

- [`18ac23f`](https://github.com/kimjh96/flemo/commit/18ac23ffd88196f13097a7729832b4e7b9076793) Run a decorator on the clock of the transition that names it. Timing on a decorator variant is now optional and inherits the screen's duration and delay for the same variant key, so one dim is longer on a slow transition and shorter on a fast one without being authored twice; write a `duration` only to override it, including `0` to snap, and note that a variant that previously omitted one snapped where it now inherits. `ease` is never inherited.
- Updated dependencies ([`c5f5e21`](https://github.com/kimjh96/flemo/commit/c5f5e2186d88ee679f5a26caa96c3457da51c41d), [`18ac23f`](https://github.com/kimjh96/flemo/commit/18ac23ffd88196f13097a7729832b4e7b9076793), [`0c6f4ab`](https://github.com/kimjh96/flemo/commit/0c6f4ab5f6ff247acd863b09c2c81348cfe4efe4), [`9f95915`](https://github.com/kimjh96/flemo/commit/9f959156e5bcce52b540a665275ba94639662c7c), [`17219e6`](https://github.com/kimjh96/flemo/commit/17219e621d7932564299e28358abf47327d53079), [`1ca911b`](https://github.com/kimjh96/flemo/commit/1ca911b7be274785801e44e75ff650c124366a6b), [`ce12ca5`](https://github.com/kimjh96/flemo/commit/ce12ca53e6cea863cc415868571a084d8fd0bf03), [`0e54a0d`](https://github.com/kimjh96/flemo/commit/0e54a0d6a4eb345964654256426b1fec7783603d), [`eaebb08`](https://github.com/kimjh96/flemo/commit/eaebb08ec576dc158af32e3a986451f575d4fdb6)):
  - @flemo/core@2.1.0
  - @flemo/react@2.1.0
  - @flemo/devtools@0.3.0

## 0.11.0

### Minor Changes

- [`5e4eb50`](https://github.com/kimjh96/flemo/commit/5e4eb50edb8cac851086cfc6f5fc18371d28bb67) Make the playground's container transform carry the whole card, not just the artwork inside it. Opening an act from the poster grid under `zoom` flies the cell itself into the detail page, so the card becomes the screen rather than releasing a square into it. The card pairs under `zoom` only: a container and an element are different claims, and pairing a box across two arrangements that disagree renders every intermediate frame as a stretched hybrid. The detail lays its artwork, name and meta out in the cell's order so the two ends of the flight are the same arrangement at two sizes.

- [`7030cd9`](https://github.com/kimjh96/flemo/commit/7030cd9761df13723e3e4a2722c00d8a3f398b7b) Rebuild the playground from the library author's own demos as one small ticketing app rather than a strip of fixtures. A listing carries its artwork into the detail as a shared element that keeps its shape at both ends, the tab bar holds between the two tabs and rides away on the push because ride-or-hold is decided by the pair, buying reaches past the top of the stack in a single transition with `until`, and a transition selector beside the stage swaps what carries the push without any screen knowing which. Wires `@flemo/devtools` rather than reinventing a flight recorder. Screen copy is the app's own in both locales, with what flemo is doing written beside the stage instead of inside the screen demonstrating it.

- [`0f8243a`](https://github.com/kimjh96/flemo/commit/0f8243aea70e040b16479337246a8986733be1f4) Give the playground's container transform the arrangement it is for. A third tab holds the same acts as a poster grid, so picking `zoom` pushes a cell's neighbours out through four edges instead of zooming a list row that has nothing to either side. The two tab surfaces scope their shared-element ids separately and the detail is told through the route which one opened it, so the tabs cannot accidentally pair all ten artworks with each other while both are mounted. The transition selector is a block of equal cells rather than one long line.

- [`502cdef`](https://github.com/kimjh96/flemo/commit/502cdefaa56ad99aed82a16594e3adea284da715) Add two consumer-authored transitions to the playground bench, so it carries the four presets the library ships plus three written on the page. `drift` is depth rather than direction: the arriving screen comes forward while the covered one recedes and never touches its own opacity, so nothing double-exposes under the shared element. It names `recess`, a decorator authored beside it and sized to its own two durations rather than borrowing the 0.7s `overlay` that exists for `cupertino`. `fade-through` sequences its two fades with `delay` so the leaving screen reaches zero exactly as the arriving one starts, and the shared element carries the eye across the instant neither screen is drawn.

- [`8190ee7`](https://github.com/kimjh96/flemo/commit/8190ee71889bd7ad4ef81e6338f44d59b1be42f0) Put the container transform on the playground bench. Picking `zoom` flies the artwork as a `zoom` morph, whose camera carries the list screen the artwork is small on, so the grid is pushed past the edges instead of sitting still while a card escapes it. It arrives with `aperture`, a transition authored for it: the camera supersedes a moving screen's transform, so `aperture` animates none and spends its length on the fade instead. The bench selects whole cases rather than crossing two axes, because the library states which pairings compose and a free cross product would offer the ones that do not.

### Patch Changes

- [`08f8494`](https://github.com/kimjh96/flemo/commit/08f8494be3fc0118c08fa7746e726c298253d9ea) Fade the detail's floating header in on each transition's own clock after the artwork's flight lands, instead of letting the landing reveal it whole in one frame.

- [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f) Add a Morph page (ko/en) covering the pairing and authoring a morph transition, replacing the old shared-element docs, and drop the site's unused `motion` dependency.

- [`fbcd479`](https://github.com/kimjh96/flemo/commit/fbcd479d175aa962f7a8f465fda435a92f67e5d2) Reverse the detail header's entrance on a pop: it lifts back above its line in the flight's first beat instead of riding the dismissing screen frozen in place.

- [`1f7bd51`](https://github.com/kimjh96/flemo/commit/1f7bd51e060f43e50e0da6a24ac4aea9e0a51626) Lower the detail header into place with a slide instead of a bare fade, and pair the act's name as a text morph on every bench case rather than only the container transform.

- [`671aae8`](https://github.com/kimjh96/flemo/commit/671aae892ba7910d3ec91c283fc51cb32b37e688) Document Layer in both languages, open the playground on the container transform, replace the bench's paragraph with one line, and clear the em-dashes from the docs prose.

- [`edec54b`](https://github.com/kimjh96/flemo/commit/edec54b9c550b615883d2e7303f69333cec1495c) Make both ends of the playground's container transform bare while the card travels. The detail's copy already left the frame for the flight; the grid cell's caption did not, so a line of type appeared out of nothing partway through and read as a shift between the title and the date. The cell's caption now runs the same part transition, so the card is a surface carrying one artwork at both ends and text exists only at rest. The artwork sits in a fixed box at both ends so nothing the flight does can move what is under it, and the detail's chrome leaves faster, since it sits where the grid's tab bar is about to reappear.

- [`5942025`](https://github.com/kimjh96/flemo/commit/5942025f1cc880a8da0e2bf4e670160e98604928) Revert the playground's sheet detour and put the camera back on the Tonight list. The two aperture rewrites (settle-and-blur, then a rising page) replaced the camera the case exists to show and are removed; `aperture` returns to holding still while the card, the ghost and the camera do the work. The list's rows are containers again under list-scoped ids, which is what carries the camera from that surface, and the row-container defects recorded earlier do not return with it, since each was fixed separately in the meantime.

- [`c93c22c`](https://github.com/kimjh96/flemo/commit/c93c22cc03bf90ddee1ccae07b6b983d19dc8c5c) Tighten the gap between the playground card's title and its date line, in the cell and on the detail. The 12px gap was there to keep the two ends' geometry sums equal for the morph; since the core now carries a nested flight from its measured from-pose, the spacing is free to be design again. The bottom padding moves off the fixed-height meta holder onto the card itself, since border-box sizing was swallowing it and leaving the date line two pixels off the card's bottom edge.

- [`aa6e8c1`](https://github.com/kimjh96/flemo/commit/aa6e8c1b3e07e2aeb221368d5a18da39ae06a090) Zero the playground caption's flight-start jumps by giving both ends of the pair identical local geometry. A flying text morph starts at its own local offsets inside the card, so every difference between the two ends' insets and spacing was a jump on the first frame: the name lurched 20px right on a push, the name and date lurched 20px left with their gap collapsing on a pop, and the facts rows spread from 20px to 24px because the flight stamps the card's computed line-height onto rows that only set a font size. Both ends now use a 16px inset, 12px under the artwork, equal title-plus-gap sums, and the facts pin their own line height; measured at the first frames of both directions, every caption delta is zero.

- [`2c23892`](https://github.com/kimjh96/flemo/commit/2c238922db2e58afdc12af5ddb1705f0a73f58d8) Keep the playground card's caption visible for the whole flight, as the previous playground did. Hiding it at flight start emptied the bottom third of the card on the first frame, so a 207px card collapsed to its 151px artwork and then grew, which read as the card shrinking before it grows. The caption now dissolves inside the card's ghost, and only the act's name is paired, as a `text` morph that re-typesets from the cell's label into the detail's heading while its clone holds the label's exact box.

- [`84804c3`](https://github.com/kimjh96/flemo/commit/84804c3de595932e2505e2b8b66f8a6e1511140a) Keep the playground card's unpaired contents out of the frame while the card is a box in flight. A morph grows a layout box and lets its subtree lay itself out at every size, so a buy control at cell width was a squeezed pill that unfurled and a page of copy was a column of two-word lines reflowing the whole way. The header, the body and the buy control now run a `card-body` part transition that arrives in the last half of the push and leaves in the first fifth of the pop, so the card crosses as a surface and its contents appear once there is room for them. It is authored raw because the dismissing screen is the active one, and the collapsed factory pins that slot to rest.

- [`4c0cc09`](https://github.com/kimjh96/flemo/commit/4c0cc09c06488c94d5d2679f94441b3c2eb7ec01) Stop the playground's container transform painting a page over the grid it is growing out of. flemo animates a morph's layout box and lets the subtree lay itself out at each size, so the detail's own type was at page size from the first frame inside a box still the size of a cell, spilling across the poster grid and doubling every line against the ghost. The card clips its contents while it grows, the act's name pairs as a `text` morph so it re-typesets from label to heading instead of being drawn twice, and the card is now the whole screen rather than its scrolling body, so the header and the buy control grow with it instead of standing at full width around a cell-sized card.

- [`e433bdf`](https://github.com/kimjh96/flemo/commit/e433bdf56dfec0f924954db0e8adbd284c374ade) Give the playground's container transform the same arrangement at both ends. The grid cell inset its artwork by 8px and the detail inset its own by 20px, so the first frame of a flight swapped one inset and corner radius for the other while both were drawn at the same size. Both now carry the artwork full-bleed across the top of the card with the type inset below it.

- [`1fb0bd7`](https://github.com/kimjh96/flemo/commit/1fb0bd7ffaa0900ee3815d0bed73110772fccbb2) Stop the playground's container transform hiding the camera it exists to show. The detail screen faded in on a front-loaded curve, so an opaque rectangle covered the poster grid about 50ms into a 500ms flight and the rest of the camera's push happened behind it, which read as the stage going black around a small card. The card is the surface under this case, so the detail hands it the background and the screen paints nothing of its own; the grid stays lit and visibly pushed out while the card grows opaque over it.

- [`104985a`](https://github.com/kimjh96/flemo/commit/104985a61fd2042e6159b3b397157a069104771e) Stop the playground's container transform starting smaller than the cell it left. A grid cell's `<button>` is `inline-block` by default, so its line box added the strut's descender under the card inside it and the card's own box measured 207px inside a 214px cell; a flight that starts from the card's box therefore started 7px shorter than the cell, which reads as the card shrinking before it grows. The button is a block now, and the flight's first frame matches the cell exactly. The caption returning to a cell also waits until the card has landed rather than fading in under an artwork that is still moving.

- [`d1d1720`](https://github.com/kimjh96/flemo/commit/d1d1720b33863152371cea3a1e4311725c8337a5) Give the playground card's chrome its own clock so the card grows naturally. The back control and the buy control are a fixed size whatever the card is: at the start of a push the card is a grid cell about 155px wide and the header's scrim alone is 90px, so the chrome covered more than half of it and then dwindled to a thin strip as the card reached full size. The card grew, the chrome did not, and the proportion inverted on the way. Chrome now arrives once the card has most of its size and leaves only once it has lost most of it, so the box travels carrying nothing but the artwork.

- [`4cc2809`](https://github.com/kimjh96/flemo/commit/4cc28090752971d715c83df2063ae7dc5301d712) Stop the playground repeating itself and leaving a desktop window half empty. The lead paragraph and the caption under the transition selector both explained the shared element and the tab bar, so the lead now says what the app is and invites a tap, and the caption alone says what to watch for. The copy column centres against the stage instead of hugging the top of it.

- [`936da99`](https://github.com/kimjh96/flemo/commit/936da99cae70a607e7dc097b31a972ebf8b46c92) Complete the reference recipe for the playground's container transform: the ghost covers the surface hand-over, and the page's own copy rides part transitions, which the previous pass had wrongly deleted as inventions. Without them the detail's header scrim stamped itself onto the cell on the flight's first frame, a dark cap appearing out of nowhere in a light theme, and the body copy's squeezed narrow-width lines read straight through the translucent ghost. The header runs a late-in late-out chrome clock, the body copy, facts and buy control arrive late and leave early, and the paired artwork, name and date ride visibly the whole way.

- [`2c822d8`](https://github.com/kimjh96/flemo/commit/2c822d8a2d6c2a89f19f95281ee044f4ebdab76b) Line up the two ends of the playground's container transform. The detail card began with a 52px header and a grid cell's card begins with its artwork, so the two artworks sat 52px apart while the flight drew both at the same box: one gradient appeared to flicker, the page appeared to shift, and the header appeared to vanish, all from that single misalignment. The header moves out of the card's flow and floats over the artwork behind a scrim, so both cards start with the artwork at the same place.

- [`09b4239`](https://github.com/kimjh96/flemo/commit/09b42399b99b5fcf7ec60e4c6558e9fdcbfe6e6c) Hold the act name's line box at both ends of the playground's container transform. A morph's slot measures 0x0 while its element is away in the flight layer, so the unheld heading collapsed inside the flying card: everything below it sat a line too high through the flight and dropped into place at the landing, which was the shift between the cell's title and its date on a pop and the shift under the detail's facts on a push, and the collapsed slot also skewed the flying name's anchor. The cell title sits in a fixed 20px holder and the detail heading in a fixed 32px one, the same treatment the artwork's fixed square already gets.

- [`7751799`](https://github.com/kimjh96/flemo/commit/7751799ef96fbd192b36f189a3771632e7082551) Fix three defects in the playground's container transform. The artwork now flies on an authored morph that carries no ghost, because a copy of the same gradient dissolving over the original at a different size beats against it instead of growing. The detail's header stops running the body's part transition, which blinked it out in 120ms while the card was still shrinking under it. The act name stops being a paired `text` morph, because the date under it stood on a box that grew every frame the type did; it arrives with the rest of the copy instead. The camera moves onto the card, since a morph riding its container cannot move the screen the container is on.

- [`b557449`](https://github.com/kimjh96/flemo/commit/b557449b17cb519e63e6e0d0b303b3a560cc78a1) Give both ends of the playground card the same meta line and pair it. The cell captioned its artwork with the date and price while the detail led with the venue and date, so during a flight the two different lines cross-faded on top of each other and collapsed to one as the ghost died, which read as a shift between the title and the date at every arrival, in both directions. The detail's meta is now the same string as the cell's, paired as a `text` morph in a fixed-height holder, so one line re-typesets from 11px to 14px instead of two lines trading places; the venue keeps its own row in the facts.

- [`94220d6`](https://github.com/kimjh96/flemo/commit/94220d6e5c2bc82ea08ad14dfb8240aef01da229) Rebuild the playground's container transform on the deleted playground's exact recipe, deleting the mechanisms invented in its place. The gradient appeared smaller than the square it left because the detail's fixed buy-bar stole ~90px from the scroller, clipping the arriving artwork to 151x117 at cell width; the buy control is in flow at the end of the content now, so the detail lays out at any card width exactly as the cell does, artwork first and full. The card flies on the built-in `zoom` and the artwork on the built-in `shared`, whose ghost covers the narrow-width phase by itself; the custom morphs and the three part transitions that imitated that ghost are deleted.

- [`a88fe4b`](https://github.com/kimjh96/flemo/commit/a88fe4b6f6f7abbc6b78c32229f27eb6a2df3b1b) Raise the playground's `aperture` to its name: the arriving page comes up from the bottom edge while the covered screen pushes out and blurs. From the list, where the card has no partner, the page previously landed opaque on the first frame and hid the whole effect behind itself, leaving only the artwork's glide; now the rise is the effect, and the pop slides the page back down over a sharpening list. From the grid the arriving screen holds nothing but a hidden stand-in, so the slide paints nothing and the camera keeps carrying the case unchanged. One definition, two surfaces, no branch.

- [`3f9c13b`](https://github.com/kimjh96/flemo/commit/3f9c13b6118e977749fffcd34ab28dc857fa9b5e) Make the playground's container transform work from the Tonight list, not only from the poster grid. The pair and the camera live on the card wrapper, and the list's rows never drew one, so picking `zoom` there flew a lone artwork over a plain fade. Each row is now a container of its own under list-scoped ids (`rowcard-`, `rowname-`), the detail answers to whichever surface opened it, and the row's venue-led meta line, which has no matching string on the detail, arrives with the body copy instead of pairing.

- [`ae242a9`](https://github.com/kimjh96/flemo/commit/ae242a97318d52047ba7648f53b8bf4dc9ac6eb6) Settle how the playground's zoom case behaves from the Tonight list, on the deleted playground's device-tested verdict. Pairing a row as a container was reverted: a row is laid across and the page is laid down, so the page ballooned out of the row with the name crossing over it, which the old playground had already recorded as broken on every transition. From the list the artwork alone is shared, and `aperture` becomes the old `sheet`: the arriving page lands opaque and settles while the covered screen pushes out and blurs, and on a pop the page drops out on a hard front-loaded curve so the list is uncovered while the artwork still has its whole glide home. From the grid the camera supersedes the push-out and the blur rides it, which is the reference pairing.

- [`e937f57`](https://github.com/kimjh96/flemo/commit/e937f5714581a36a52a9cbd961e3eca483307a56) Give the poster artwork its own top rounding so the pair carries a radius through element-morph flights, and let the detail header settle in over a third of a second instead of blinking in after the landing.

- [`e4c61d1`](https://github.com/kimjh96/flemo/commit/e4c61d122c4f167b3065e573a4d170177b52fc7f) Drop the `@flemo/react-layout` migration section and its peer dependency mentions from the docs, now that the package is gone from the repository. Shared elements are documented as `<Morph>` in `@flemo/react` with no animation library beside it.

- [`bdf103a`](https://github.com/kimjh96/flemo/commit/bdf103a1517f8e7c65842f51bac3210f987e4521) Hold the returning row's unpaired venue and price lines back until the zoom pop's ghost has thinned, scoped to the row staged in the flight layer so the rows at rest never blink.

- [`d006b5f`](https://github.com/kimjh96/flemo/commit/d006b5f729c9178acc2f633cd8fb521376f7e797) Hold the list row's artwork in a fixed square so its nested flight never reflows the row: staged at detail size it squeezed the title's flex slot to zero, which made the title's own flight decline and the name grow back in from the right on a pop.

- [`1f7bd51`](https://github.com/kimjh96/flemo/commit/1f7bd51e060f43e50e0da6a24ac4aea9e0a51626) Replace the fade-through bench case with a modal sheet: the detail rises from the bottom edge on asymmetric clocks while the list recedes a step, and the shared element still flies across it.

- [`bd06124`](https://github.com/kimjh96/flemo/commit/bd06124403774b3e806087fc05b111cec30cb8c8) Let fixed overlays inside a nested Slot cover surrounding shared bars without portals or consumer workarounds. Clarify when fixed overlays escape the Slot boundary.
- Updated dependencies ([`5c0dcc0`](https://github.com/kimjh96/flemo/commit/5c0dcc0cb9a24d5dc7647428d7c88f111c172353), [`e937f57`](https://github.com/kimjh96/flemo/commit/e937f5714581a36a52a9cbd961e3eca483307a56), [`08f8494`](https://github.com/kimjh96/flemo/commit/08f8494be3fc0118c08fa7746e726c298253d9ea), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`69ac179`](https://github.com/kimjh96/flemo/commit/69ac179a479706c2704be7f45497c136bd12b16b), [`d006b5f`](https://github.com/kimjh96/flemo/commit/d006b5f729c9178acc2f633cd8fb521376f7e797), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`98ede19`](https://github.com/kimjh96/flemo/commit/98ede190f0cdf8239b96a0c5fa78700bc69d700e), [`fefc815`](https://github.com/kimjh96/flemo/commit/fefc8155a4dafdc614d9be4d2152569f71c9bbb9), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`2f1e394`](https://github.com/kimjh96/flemo/commit/2f1e394a9c95de44e11f9bad49340b95acdbc4a3), [`8e5e401`](https://github.com/kimjh96/flemo/commit/8e5e40144264e39a6cf804b87b1b8194a7b60be6), [`52ff075`](https://github.com/kimjh96/flemo/commit/52ff0759973b5f1ee87079a3a0fd796bf7952827), [`27425a9`](https://github.com/kimjh96/flemo/commit/27425a96b47042ac665008c1ce89ad47f031497e), [`d006b5f`](https://github.com/kimjh96/flemo/commit/d006b5f729c9178acc2f633cd8fb521376f7e797), [`2741f85`](https://github.com/kimjh96/flemo/commit/2741f8515f2f0e4e4288f2d7b07ea76a5b13d183), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`1f7f78f`](https://github.com/kimjh96/flemo/commit/1f7f78f66804a8d9341ab3386f188541aeac8e0b), [`bd06124`](https://github.com/kimjh96/flemo/commit/bd06124403774b3e806087fc05b111cec30cb8c8), [`9b93703`](https://github.com/kimjh96/flemo/commit/9b9370329a67d45dd4f896830f651bbe82d85d7f), [`57bbab4`](https://github.com/kimjh96/flemo/commit/57bbab432c4cfa76c04c7a5f0546c2b6cc6a6204)):
  - @flemo/react@2.0.0
  - @flemo/core@2.0.0
  - @flemo/devtools@0.3.0

## 0.10.20

### Patch Changes

- Updated dependencies ([`8cb6366`](https://github.com/kimjh96/flemo/commit/8cb636674b2634510253d2265569904c6da05e69), [`5b83d3b`](https://github.com/kimjh96/flemo/commit/5b83d3b46ed268ee07e834e7d7819a4e577a1111), [`d70ced3`](https://github.com/kimjh96/flemo/commit/d70ced37926a359b192b5f5b3b8f9151f340ec5b), [`7b7fdd3`](https://github.com/kimjh96/flemo/commit/7b7fdd3595c8697967b9db56f6aea1aa942b149f), [`d15b18a`](https://github.com/kimjh96/flemo/commit/d15b18ad91687a7e564f0f8be54e55554b181adf), [`05e4d40`](https://github.com/kimjh96/flemo/commit/05e4d4072d4cd5555ef63cfde8dd0e8985426720), [`28fb128`](https://github.com/kimjh96/flemo/commit/28fb1280661f1d886f898310c5b86318e2772d36), [`3ddef71`](https://github.com/kimjh96/flemo/commit/3ddef71eed6bd53b2624d190668390295019c9ac), [`d250cc5`](https://github.com/kimjh96/flemo/commit/d250cc5bf3dbc9b8699f6387c219311bd23dca28), [`a4c1a74`](https://github.com/kimjh96/flemo/commit/a4c1a744f343b86352cc74e1616144f1b35109ad), [`ebf7d78`](https://github.com/kimjh96/flemo/commit/ebf7d786bd8a8154d9322796f2bec413fcf9131e), [`e67146a`](https://github.com/kimjh96/flemo/commit/e67146a4c6857d90de88c372732a92d005e6d305), [`a8ed9cd`](https://github.com/kimjh96/flemo/commit/a8ed9cd4aa3298eb6e3e6fc38930de3056f3ebc3), [`f32c2cc`](https://github.com/kimjh96/flemo/commit/f32c2cc7022dd8d32382420c3a26054546cfaf48), [`fbd937c`](https://github.com/kimjh96/flemo/commit/fbd937c2fe15b451c6b216e524379d85a4cf5849), [`9f1205c`](https://github.com/kimjh96/flemo/commit/9f1205c42d37f354828c17463862dd0838d0c0ba)):
  - @flemo/core@1.30.0
  - @flemo/react@1.12.8
  - @flemo/react-layout@0.1.52

## 0.10.19

### Patch Changes

- Updated dependencies ([`47332c9`](https://github.com/kimjh96/flemo/commit/47332c92c2b530e4b1fc2426b62dcfb5490b5f69), [`b89635e`](https://github.com/kimjh96/flemo/commit/b89635eb83ca3b685b61c0c03fdd85294e82f684)):
  - @flemo/core@1.29.0
  - @flemo/react@1.12.7
  - @flemo/react-layout@0.1.51

## 0.10.18

### Patch Changes

- Updated dependencies ([`ab29846`](https://github.com/kimjh96/flemo/commit/ab29846347076b8c102e8acca6a95b859174a72c), [`a97af55`](https://github.com/kimjh96/flemo/commit/a97af5544dc6cb426a9daf8868af5cd7b11b2903), [`c987660`](https://github.com/kimjh96/flemo/commit/c987660617927cdcfbc733e5b8cf4fe67bd707fd), [`e093b50`](https://github.com/kimjh96/flemo/commit/e093b50d19e7c3e526f44c2a6b29f9ceffa7bdfc)):
  - @flemo/core@1.28.1
  - @flemo/react@1.12.6
  - @flemo/react-layout@0.1.50

## 0.10.17

### Patch Changes

- Updated dependencies ([`db0985b`](https://github.com/kimjh96/flemo/commit/db0985b6d5e81bf5a2cd0e24bba97b0176cd2844), [`d30a03f`](https://github.com/kimjh96/flemo/commit/d30a03fb860a3850c2925c9f67dad5615a7d50ac)):
  - @flemo/core@1.28.0
  - @flemo/react@1.12.5
  - @flemo/react-layout@0.1.49

## 0.10.16

### Patch Changes

- Updated dependencies ([`034a295`](https://github.com/kimjh96/flemo/commit/034a295aae17d2cb2a872b07666d6d570cec6753)):
  - @flemo/core@1.27.1
  - @flemo/react@1.12.4
  - @flemo/react-layout@0.1.48

## 0.10.15

### Patch Changes

- Updated dependencies ([`cbb258d`](https://github.com/kimjh96/flemo/commit/cbb258da2b94456d3c7d31db6ab1bbada0ceb764), [`fb4bb71`](https://github.com/kimjh96/flemo/commit/fb4bb71074f697435acfe8609b4073e2e2c4adc0), [`e89b3e7`](https://github.com/kimjh96/flemo/commit/e89b3e776722ea972250c5fe4af91083ba33a643), [`c0232a9`](https://github.com/kimjh96/flemo/commit/c0232a940c614b6442b63b8abf61ba8d86a94adf), [`b786a0b`](https://github.com/kimjh96/flemo/commit/b786a0b9a5fa81b19ab38b6f77e0d7149eca5d81)):
  - @flemo/core@1.27.0
  - @flemo/react@1.12.3
  - @flemo/react-layout@0.1.47

## 0.10.14

### Patch Changes

- Updated dependencies ([`6b1bb93`](https://github.com/kimjh96/flemo/commit/6b1bb93383221c29ba0d630123ca60a7b8f16d30), [`d6dab7f`](https://github.com/kimjh96/flemo/commit/d6dab7f398024dd3f9cae885aba9dfa73b48dda6), [`9d706dc`](https://github.com/kimjh96/flemo/commit/9d706dcda42aacc4d15262dd76fbe7821a52d541), [`9685d02`](https://github.com/kimjh96/flemo/commit/9685d020fea2e6f87ee7893a6b3d616cd8cc26bd)):
  - @flemo/core@1.26.0
  - @flemo/react@1.12.2
  - @flemo/react-layout@0.1.46

## 0.10.13

### Patch Changes

- Updated dependencies ([`445e116`](https://github.com/kimjh96/flemo/commit/445e1163cf3b53d31b3b3cd0e19856bcd237aa9e)):
  - @flemo/core@1.25.1
  - @flemo/react@1.12.1
  - @flemo/react-layout@0.1.45

## 0.10.12

### Patch Changes

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
- Updated dependencies ([`fb09af3`](https://github.com/kimjh96/flemo/commit/fb09af3b9c8b153ccfb12190ce55c460a67ef3b9), [`55d4fc5`](https://github.com/kimjh96/flemo/commit/55d4fc57ae4ab0d585a1887a6952026f769390a9)):
  - @flemo/react@1.12.0
  - @flemo/react-layout@0.1.44

## 0.10.11

### Patch Changes

- Updated dependencies ([`c2aa749`](https://github.com/kimjh96/flemo/commit/c2aa749a4064ebe68f22bc2ad4e7f8f88c0d41bb)):
  - @flemo/core@1.25.0
  - @flemo/react@1.11.1
  - @flemo/react-layout@0.1.43

## 0.10.10

### Patch Changes

- [`f07c28e`](https://github.com/kimjh96/flemo/commit/f07c28ed711d08adc85a5fb3e97b297e46eb64ea) Resolve `@flemo/devtools` to an inert entry in production builds. The package now ships `development` / `production` export conditions, so a plain top-level import keeps the recorder and the panel out of a production bundle without the caller writing a dynamic-import guard — the guard was easy to forget, and forgetting it shipped the tool to every visitor silently. `@flemo/devtools/force` resolves to the real tool whatever the build mode, for a staging deploy or an e2e suite that must run against a production build.
- Updated dependencies ([`f07c28e`](https://github.com/kimjh96/flemo/commit/f07c28ed711d08adc85a5fb3e97b297e46eb64ea)):
  - @flemo/devtools@0.2.0

## 0.10.9

### Patch Changes

- [`7e7a96b`](https://github.com/kimjh96/flemo/commit/7e7a96b5701818c5c4e251a5d3fa84a5def983ac) Introduce @flemo/devtools: a zero-dependency flight recorder that captures per-transition driver routing, frame pacing, long tasks, landing residues, active debug overrides, and environment/observation-trap fingerprints into a single JSON report for humans and coding agents. Attach with attachFlightRecorder() or ?devtools=on in the playground.

- [`455739c`](https://github.com/kimjh96/flemo/commit/455739c3d2428c4890eda63ee1c2d0346454e20b) Load the flight recorder through a dev-only dynamic import so it no longer ships in the playground's production bundle, and document the same pattern in the `@flemo/devtools` README. Installing the package as a devDependency controls what is installed, not what is bundled — a plain top-level import of a package you call at runtime reaches every visitor.

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
- Updated dependencies ([`30c2a54`](https://github.com/kimjh96/flemo/commit/30c2a5428e3561aa0d43295df852031c02975e39), [`9b16d8f`](https://github.com/kimjh96/flemo/commit/9b16d8fcd5b267b0e8865001c8db505be56814cf), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`7e7a96b`](https://github.com/kimjh96/flemo/commit/7e7a96b5701818c5c4e251a5d3fa84a5def983ac), [`14e0a76`](https://github.com/kimjh96/flemo/commit/14e0a767c83a0a0cb4ebdb14c5e6a46e75437e48), [`cec6ab6`](https://github.com/kimjh96/flemo/commit/cec6ab66d6334fe8203ea304fe496ff6849fa559), [`0473551`](https://github.com/kimjh96/flemo/commit/0473551b5911d203ae7984ba53623baa6268396b), [`fca7692`](https://github.com/kimjh96/flemo/commit/fca7692bfccdb9d3e5a9cd89ecdb97d99640ad80), [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745), [`f6463d9`](https://github.com/kimjh96/flemo/commit/f6463d97d08c722b036ee4f436112d016460f45b), [`b495c99`](https://github.com/kimjh96/flemo/commit/b495c99651e2eb73f720d2f802525b538a782c95), [`20744c0`](https://github.com/kimjh96/flemo/commit/20744c0f2ed1bcfd8d50a5c4b6c9fb52bc7d9226), [`945eaba`](https://github.com/kimjh96/flemo/commit/945eabace0200a7693271e9433e28da62f2e848a), [`88c5cff`](https://github.com/kimjh96/flemo/commit/88c5cff30f3edd580b4a52513e287aa1c082882f), [`14923eb`](https://github.com/kimjh96/flemo/commit/14923eb8d7f6c9c3574d8c95db606ff190b2ca54), [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745), [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9), [`2be1e05`](https://github.com/kimjh96/flemo/commit/2be1e05a6d18883830edeaffbe5db7d724ebb204), [`6d6dae8`](https://github.com/kimjh96/flemo/commit/6d6dae8f98b159d3faa5b0b57a637288fffc6c53), [`6d3cc23`](https://github.com/kimjh96/flemo/commit/6d3cc238755a1a7d2d25edbf9113ea7c27fc571e), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541), [`bfd077a`](https://github.com/kimjh96/flemo/commit/bfd077a0b67181da88f73d46ccadcff73b7ff65d), [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9)):
  - @flemo/core@1.24.0
  - @flemo/react@1.11.0
  - @flemo/devtools@0.1.0
  - @flemo/react-layout@0.1.42

## 0.10.8

### Patch Changes

- Updated dependencies ([`490b0e4`](https://github.com/kimjh96/flemo/commit/490b0e420429b828011c7092c549f52258beae80)):
  - @flemo/core@1.23.0
  - @flemo/react@1.10.0
  - @flemo/react-layout@0.1.41

## 0.10.7

### Patch Changes

- Updated dependencies ([`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e), [`0c721b8`](https://github.com/kimjh96/flemo/commit/0c721b8c27bea2d895f855a1a8384ccc42a87c97), [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e)):
  - @flemo/core@1.22.1
  - @flemo/react@1.9.0
  - @flemo/react-layout@0.1.40

## 0.10.6

### Patch Changes

- Updated dependencies ([`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0), [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0)):
  - @flemo/core@1.22.0
  - @flemo/react@1.8.2
  - @flemo/react-layout@0.1.39

## 0.10.5

### Patch Changes

- Updated dependencies ([`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e), [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e), [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e)):
  - @flemo/core@1.21.1
  - @flemo/react@1.8.1
  - @flemo/react-layout@0.1.38

## 0.10.4

### Patch Changes

- Updated dependencies ([`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f), [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f)):
  - @flemo/core@1.21.0
  - @flemo/react@1.8.0
  - @flemo/react-layout@0.1.37

## 0.10.3

### Patch Changes

- [`d048950`](https://github.com/kimjh96/flemo/commit/d04895094b2add35550afd806f8011e924c6c161) Drive the hero demo's card roll from a pause-aware shared clock: hovering now freezes and resumes the roll at the exact pose (the wall-clock phase teleported the paused cards), and returning to home re-anchors the roll as if it had carried on while away.

## 0.10.2

### Patch Changes

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Keep the hero demo's card-roll phase across screen freezes: returning to home no longer resets the roll to the same leading card, and the landing no longer shows a pose jump.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Make the playground panel-title scrub read as continuous under slow swipes: the travel grows to 18px and the recovery compresses into the drag's first 60%, so the title advances about one pixel per 13px of drag instead of one per 39px.
- Updated dependencies ([`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6), [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6)):
  - @flemo/core@1.20.0
  - @flemo/react@1.7.2
  - @flemo/react-layout@0.1.36

## 0.10.1

### Patch Changes

- [`d979a33`](https://github.com/kimjh96/flemo/commit/d979a33db7642e70bb3687cd12593b789c7dcc39) Revert the shell-first children deferral and re-anchor the transition gate to the motion start. Screens enter with their real content in the first frame again — no blank shell, no late content pop-in, no perceived double render. A heavy mount commit now delays the transition start by exactly its cost instead of snapping the transition away: the gate backstop re-arms while the hold is pending and restarts with a full window when the motion actually begins.
- Updated dependencies ([`d979a33`](https://github.com/kimjh96/flemo/commit/d979a33db7642e70bb3687cd12593b789c7dcc39)):
  - @flemo/react@1.7.1
  - @flemo/core@1.19.1
  - @flemo/react-layout@0.1.35

## 0.10.0

### Minor Changes

- [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8) Add a first-class "Stress lab" to the playground: an explained screen (reached from the control dock) where you pick a transition, content shape, and render cost, then run a heavy screen to watch the transition play immediately while its content pops in only once ready. Replaces the hidden debug overlay. The panel browser is now its own nested Router with the control dock as persistent chrome, so the dock holds still across panel moves but rides the transition out with the panels screen when entering the stress lab, its entry row choreographed by a part transition.

### Patch Changes

- [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8) Start transitions against the screen shell: a screen mounting into a push or replace now renders its frame first and mounts consumer children in a deferred commit once the transition's first frame has painted, so heavy content can no longer freeze or swallow the animation. The rAF player also re-anchors its clock across long main-thread stalls, resuming motion instead of fast-forwarding to the end. `@flemo/core` gains a `shouldMountShellFirst` export so the shell-first decision stays framework-neutral, a new public API that lifts core to a minor bump.
- Updated dependencies ([`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8), [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8), [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8)):
  - @flemo/react@1.7.0
  - @flemo/core@1.19.0
  - @flemo/react-layout@0.1.34

## 0.9.3

### Patch Changes

- Updated dependencies ([`c2ddae3`](https://github.com/kimjh96/flemo/commit/c2ddae3e4ea6ade5cc5ee2c9651c152bb2f2232d)):
  - @flemo/core@1.18.1
  - @flemo/react@1.6.9
  - @flemo/react-layout@0.1.33

## 0.9.2

### Patch Changes

- Updated dependencies ([`4214525`](https://github.com/kimjh96/flemo/commit/4214525eba426cf29c3f00adeb404126c9cd6b67)):
  - @flemo/core@1.18.0
  - @flemo/react@1.6.8
  - @flemo/react-layout@0.1.32

## 0.9.1

### Patch Changes

- Updated dependencies ([`980af25`](https://github.com/kimjh96/flemo/commit/980af254371f322d1a7bdbbc657d449e6be464ed)):
  - @flemo/core@1.17.0
  - @flemo/react@1.6.7
  - @flemo/react-layout@0.1.31

## 0.9.0

### Minor Changes

- [`7be3e36`](https://github.com/kimjh96/flemo/commit/7be3e3616dc49943cc089b63f44e49768b1bf522) Document screen-level swipe hooks on the Transitions page (swipeDirection, onSwipeStart/onSwipe/onSwipeEnd, cupertino's wiring as the worked example) and slim the Part page's swipe section down to its per-element differences.

## 0.8.0

### Minor Changes

- [`6013bf5`](https://github.com/kimjh96/flemo/commit/6013bf582c3e2649ba43666760c38dfcfb9a01c8) Document the `<Part>` element transition end to end (part transitions, swipe hooks, the playground's panel-title as reference), add the custom-transition value coverage guarantee with the Wipe clip-path example, and sweep the docs for stale statements.

## 0.7.15

### Patch Changes

- [`15ab16b`](https://github.com/kimjh96/flemo/commit/15ab16b5c2dc0e8b015f965c8871358a9fc26532) Make <Part> motion natural across a swipe. Cleanups (COMPLETED strips, unmounts) now drop any in-flight settle without writing, so a late settle can never shadow the rest rules, and a committed swipe keeps the previous side's part landing values in place instead of stripping them a frame early (the engine's COMPLETED cleanup owns the strip). The playground's panel-title Part gains the reference swipe hooks: the returning screen's title recovers with the drag progress and settles the remainder on release, matching how the screens themselves move.
- Updated dependencies ([`15ab16b`](https://github.com/kimjh96/flemo/commit/15ab16b5c2dc0e8b015f965c8871358a9fc26532)):
  - @flemo/core@1.16.1
  - @flemo/react@1.6.6
  - @flemo/react-layout@0.1.30

## 0.7.14

### Patch Changes

- Updated dependencies ([`39bc7ea`](https://github.com/kimjh96/flemo/commit/39bc7eab906cb785a50405be7ea7438f0e6c4293)):
  - @flemo/core@1.16.0
  - @flemo/react@1.6.5
  - @flemo/react-layout@0.1.29

## 0.7.13

### Patch Changes

- [`1a21cfc`](https://github.com/kimjh96/flemo/commit/1a21cfc94a8a01fba0e920fa179e67e4d0d84448) Put the last two compositor-clocked motions on the player's clock. Swipe releases (the settle after a gesture lets go) now run as scrubbed single-keyframe Web Animations — the browser fills the start from the element's current position, exactly like the CSS transition they replace, while a shared main-thread clock steps every settling participant together; a new write to a settling element pins its current values first, so a re-grab takes over seamlessly. <Part> elements now join the navigation's shared player alongside their screen, bars, and dim, each with its own registered motion. Where WAAPI is unavailable the previous CSS paths remain byte-for-byte in charge, and settle frame gaps are deliberately excluded from the driver policy's demotion statistics (a release routinely overlaps the commit it triggers). The playground panel titles gain a "panel-title" Part demonstrating both.
- Updated dependencies ([`1a21cfc`](https://github.com/kimjh96/flemo/commit/1a21cfc94a8a01fba0e920fa179e67e4d0d84448)):
  - @flemo/core@1.15.0
  - @flemo/react@1.6.4
  - @flemo/react-layout@0.1.28

## 0.7.12

### Patch Changes

- [`8236d28`](https://github.com/kimjh96/flemo/commit/8236d28865712207b02b5b701bbb9aab6f6405af) Extend the rAF player to EVERY motion a transition can declare. Values the numeric interpolator cannot pair (clip-path morphs across templates, calc() expressions, mixed units, one-sided properties) are now driven by a scrubbed Web Animation: created paused, its currentTime stepped every frame from the same shared clock, so the browser interpolates with exact CSS semantics while the progression stays main-thread-driven — the same compositor-jank immunity as the numeric tier, for built-in and user-authored transitions alike. The compiled CSS path remains only for replay chains, policy-demoted devices, and environments without WAAPI. The playground gains a "Wipe" transition whose mismatched clip-path templates exercise this tier end-to-end.
- Updated dependencies ([`8236d28`](https://github.com/kimjh96/flemo/commit/8236d28865712207b02b5b701bbb9aab6f6405af)):
  - @flemo/core@1.14.0
  - @flemo/react@1.6.3
  - @flemo/react-layout@0.1.27

## 0.7.11

### Patch Changes

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Declare the playground panels' screen background as opaque (they are visually opaque via their gradient fill) so the pre-raster parks engage; no visual change.
- Updated dependencies ([`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713), [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713)):
  - @flemo/core@1.13.0
  - @flemo/react@1.6.2
  - @flemo/react-layout@0.1.26

## 0.7.10

### Patch Changes

- Updated dependencies ([`1d2edf0`](https://github.com/kimjh96/flemo/commit/1d2edf012f5030fa8c834a59c9c49ee500d8a30f)):
  - @flemo/core@1.12.1
  - @flemo/react@1.6.1
  - @flemo/react-layout@0.1.25

## 0.7.9

### Patch Changes

- [`2553ce0`](https://github.com/kimjh96/flemo/commit/2553ce036c6656ee89317ebec6d6c83c8d28050c) Drop the Layer docs page and the unused SendSheet demo following the removal of `<Layer>` from @flemo/react.
- Updated dependencies ([`2553ce0`](https://github.com/kimjh96/flemo/commit/2553ce036c6656ee89317ebec6d6c83c8d28050c)):
  - @flemo/react@1.6.0
  - @flemo/react-layout@0.1.24

## 0.7.8

### Patch Changes

- Updated dependencies ([`51c9eac`](https://github.com/kimjh96/flemo/commit/51c9eacf9afcf68dcc1731e3d7fee5b443e7d9e6)):
  - @flemo/core@1.12.0
  - @flemo/react@1.5.8
  - @flemo/react-layout@0.1.23

## 0.7.7

### Patch Changes

- Updated dependencies ([`bce265d`](https://github.com/kimjh96/flemo/commit/bce265d3e4b50823d3f557872e052ced5b4a72fe)):
  - @flemo/core@1.11.0
  - @flemo/react@1.5.7
  - @flemo/react-layout@0.1.22

## 0.7.6

### Patch Changes

- Updated dependencies ([`3580635`](https://github.com/kimjh96/flemo/commit/3580635dabf45d9ce23743ff17440750e4bc9ffe)):
  - @flemo/core@1.10.1
  - @flemo/react@1.5.6
  - @flemo/react-layout@0.1.21

## 0.7.5

### Patch Changes

- [`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586) Soften the full-page shove easing so its velocity peak no longer concentrates where a late frame reads as a hitch, and shrink the header logo assets from 3000×3000 to 180×180 (they rendered at 26px and re-decoded 36MP on every return to the home screen).
- Updated dependencies ([`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586)):
  - @flemo/core@1.10.0
  - @flemo/react@1.5.5
  - @flemo/react-layout@0.1.20

## 0.7.4

### Patch Changes

- Updated dependencies ([`40d8584`](https://github.com/kimjh96/flemo/commit/40d8584c75291b96b10a3cda59c93d40acc3209c)):
  - @flemo/core@1.9.0
  - @flemo/react@1.5.4
  - @flemo/react-layout@0.1.19

## 0.7.3

### Patch Changes

- [`15172f6`](https://github.com/kimjh96/flemo/commit/15172f6a9a882e64d86d36fc436ea828d938be00) Remove the header theme-toggle icon flicker on first load. The selected theme is mirrored to a cookie, read server-side, and used to render the matching icon on first paint, so the mount gate (and its empty placeholder) is gone.
- Updated dependencies ([`4e54577`](https://github.com/kimjh96/flemo/commit/4e545777a41fa1dac7b23aba193cc85f3cf73c7f)):
  - @flemo/core@1.8.0
  - @flemo/react@1.5.3
  - @flemo/react-layout@0.1.18

## 0.7.2

### Patch Changes

- Updated dependencies ([`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19), [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19)):
  - @flemo/core@1.7.0
  - @flemo/react@1.5.2
  - @flemo/react-layout@0.1.17

## 0.7.1

### Patch Changes

- Updated dependencies ([`7513f82`](https://github.com/kimjh96/flemo/commit/7513f82eac7788d7c49ba57efd248a60b4d906f2)):
  - @flemo/core@1.6.1
  - @flemo/react@1.5.1
  - @flemo/react-layout@0.1.16

## 0.7.0

### Minor Changes

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Docs and playground sub-pages are now real composed URLs under `/docs` and `/playground` instead of fake `/doc` and `/stage` paths. They are deep-linkable and refresh-safe (no more 404s), and browser back/forward walks between them.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Make the docs a flemo zone: a slide-in-from-right entry, a persistent glass sidebar with the content area transitioning vertically on its own, and concise bilingual content. Add a second app to the landing hero (a music mini-app) so the wallet and music demos roll diagonally, and give the header per-menu, idempotent navigation with smoother transitions.

- [`5d6c6de`](https://github.com/kimjh96/flemo/commit/5d6c6de517b735308c397c02242b65198f60c0fe) Add a flemo app-shell skeleton at the noindex `/shell` preview route: one root Router with a persistent header outside a `<Slot>`, and Home/Showcase peer screens that move with a Material shared-axis (X) transition. This is the groundwork for rebuilding the landing and showcase as a flemo app; the live shiflo phone and migrated content follow in later PRs.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Mobile: the header menu is now a history-backed step with an open and close animation, and the docs sidebar opens as a sheet so other pages stay reachable. The home Get started button navigates again, the 404 and 500 pages localize by URL, and the landing and docs copy is reworked.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Group the playground transition picker into Built-in and Custom, tag the decorator combos (dive + tunnel, ripple + ripples), and add a "View source" panel that shows each transition's createTransition definition. The panel is driven by flemo's useStep, so it opens as a history step and the browser Back button closes it.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Bring back the authored playground transitions (blur, reveal, dive, ripple, card stack, spring; dive and ripple carry their decorators) so the playground shows what custom transitions can do. Restore the end-to-end suite, now covering shell navigation, the playground transitions, docs, and the language toggle against the rebuilt surfaces.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Replace the hero placeholder with a live, interactive flemo demo: a wallet app ("flemo pay") built as a nested Router with its own in-memory history, running natively in the shell (no iframe). It exercises shared-axis tabs over a persistent tab bar, a cupertino push to a transaction detail with swipe-back, and a `<Layer>` glass bottom sheet.

### Patch Changes

- [`c9b3cc8`](https://github.com/kimjh96/flemo/commit/c9b3cc8e5f998e2e6ede89d7c0a6afda5af9e412) Add a "Partial-area regions" playground demo: a persistent header and footer around a nested `<Router>` card region whose steps slide within their box, showing a sub-region transitioning on its own local history while everything around it stays put.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Make entering the docs section a full-width horizontal shove like the playground, instead of a cover: the marketing surface now slides all the way out to the left rather than receding 18% and dimming under the incoming docs page. The docs sidebar page-to-page transition is unchanged (the vertical fade).

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Unify the docs sidebar with the content area across themes. It dropped the faint
  white tint, blur, and right divider that only showed up against the dark
  background, so the sidebar now shares the page background seamlessly in both
  light and dark mode.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Cap and center the docs layout so the reading column stays next to the sidebar on
  wide screens, instead of drifting far to the right with a large empty gap.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Refine the Korean marketing copy to read naturally instead of like a literal
  translation (showcase and playground subtitles, the hero subtitle wording).

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add a Layer docs page, reflect the renamed top/bottom bar props, and rework the Slot, shared-bar, raw-transition, and safe-area sections for accuracy. Polish the landing and docs copy.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Keep the locale prefix in the shell URL with a locale-aware history driver instead of stripping it on entry. The Router matches unprefixed paths while the driver maps the `/ko` prefix, so SEO URLs are preserved, the language survives a refresh from the URL (no localStorage), the toggle switches locale in place by re-prefixing, and the load-time URL strip is gone.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Give each page its own SEO metadata (per-doc titles and descriptions, localized
  showcase/playground titles) instead of a single shared title. Remove fumadocs
  entirely: docs render from typed data, locale routing moves to a small custom
  middleware, and the body uses the app's own color tokens, dropping fumadocs-core,
  fumadocs-ui, fumadocs-mdx and the unused MDX content/search pipeline.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Server-render the shell at the requested route (each page passes its initPath, nested Docs/Playground Routers seed from the matched slug/panel), removing the blank-frame flicker on load and the deep-link hydration mismatch. The playground source panel now stays mounted and slides open/closed via a CSS transition, so closing animates too.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add a mobile header menu, keep the chosen language across a refresh (localStorage), highlight the active menu for composed sub-page URLs, reflect the nested panel id in the playground URL, and animate the playground source panel. Decorator chips are marked aria-hidden so the chip's name stays the transition.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Smooth the full-page shove slides (entering the playground vertically, the docs
  horizontally). They now share one ease-in-out curve so the conveyor glides out
  of rest and lands softly instead of snapping into motion.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Polish the playground "View source" panel: the code now scrolls inside its
  rounded frame (so the scrollbar no longer squares off the corners), reserves the
  floating control dock's height instead of hiding the last lines behind it, and
  drops the leading `"use client"` directive from the displayed source.
- Updated dependencies ([`f04a8d1`](https://github.com/kimjh96/flemo/commit/f04a8d17c587d7ab930e548a45497d63fa85bf95), [`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13), [`9937291`](https://github.com/kimjh96/flemo/commit/993729187939f96122381cd740343a7a8878efc1), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912), [`f9f0214`](https://github.com/kimjh96/flemo/commit/f9f02140b091903ffa9f7a64494a5c1d8d56b084)):
  - @flemo/react@1.5.0
  - @flemo/core@1.6.0
  - @flemo/react-layout@0.1.15

## 0.6.7

### Patch Changes

- Updated dependencies ([`e316444`](https://github.com/kimjh96/flemo/commit/e316444d3327df09569cd4568eb697878da85bff)):
  - @flemo/react@1.4.2
  - @flemo/react-layout@0.1.14

## 0.6.6

### Patch Changes

- Updated dependencies ([`080024f`](https://github.com/kimjh96/flemo/commit/080024f7daa158c4ed36ba25d516eaaa04908aa5)):
  - @flemo/react@1.4.1
  - @flemo/react-layout@0.1.13

## 0.6.5

### Patch Changes

- [`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1) Add progress-driven part transitions. `createPartTransition` defines a named, status×active animation for a single element (any CSS property), and `<Part name="...">` runs it on that element anywhere inside a screen: an app/navigation bar child, body content, anything. Programmatic transitions play on the compositor with no React re-render, and the same definition follows the swipe-back drag inline. Register the transitions through the `Router`'s `partTransitions` prop. `createRawPartTransition` gives full per-variant control.
- Updated dependencies ([`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1)):
  - @flemo/core@1.5.0
  - @flemo/react@1.4.0
  - @flemo/react-layout@0.1.12

## 0.6.4

### Patch Changes

- [`0e791dc`](https://github.com/kimjh96/flemo/commit/0e791dc159a71336898cf76caadeb100f3b2e0bb) Roll up Renovate dependency updates: next `^16.2.9`, fumadocs-core/ui `^16.10.4`, fumadocs-mdx `^15.0.12`. Also refreshes toolchain (pnpm 11.8.0, typescript-eslint `^8.61.1`) with no API changes.
- Updated dependencies ([`05cc7eb`](https://github.com/kimjh96/flemo/commit/05cc7eba37ede2ca088c1ea73116a9b99388f7f6)):
  - @flemo/react@1.3.2
  - @flemo/react-layout@0.1.11

## 0.6.3

### Patch Changes

- Updated dependencies ([`343ea33`](https://github.com/kimjh96/flemo/commit/343ea3331ed5ac3f087fdf8fb0ed0a9ebf4c1062)):
  - @flemo/react@1.3.1
  - @flemo/react-layout@0.1.10

## 0.6.2

### Patch Changes

- [`edb8a57`](https://github.com/kimjh96/flemo/commit/edb8a57c406f808f7e19238cc662e79eac2d3091) Replace em-dash connectors with plain punctuation across the docs and playground copy for a less machine-written tone. Standalone table placeholders and the empty-value glyph stay as-is.

- [`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551) Roll up Renovate dependency updates. Bump runtime and peer ranges: `react`/`react-dom` to `^19.2.7`, `motion` to `^12.40.0`, `path-to-regexp` to `^8.4.2`, `zustand` to `^5.0.14`. Also refreshes web app and toolchain deps (next, fumadocs, tailwindcss, eslint, typescript, vite) with no API changes.

- [`1d8c769`](https://github.com/kimjh96/flemo/commit/1d8c769f9ab46718d4c6935932dd6e393e6463b6) Update the docs build toolchain to fumadocs-mdx 15. No content or routing changes.

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

- Updated dependencies ([`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551), [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6)):
  - @flemo/core@1.4.0
  - @flemo/react@1.3.0
  - @flemo/react-layout@0.1.9

## 0.6.1

### Patch Changes

- [`49288b9`](https://github.com/kimjh96/flemo/commit/49288b91458a5e5396ee044b8f9bfa28f9b3087b) Fix the landing/showcase header overflowing on mobile. Nav links now collapse
  into a hamburger menu below the `md` breakpoint instead of overlapping the logo.

## 0.6.0

### Minor Changes

- [`c0d0d5f`](https://github.com/kimjh96/flemo/commit/c0d0d5f522934a97403b56133fed2f372dada194) Add a Showcase page (`/showcase`) and a Showcase nav link, featuring real apps built with flemo. Launches with shiflo — a hybrid app on the App Store and Google Play — and is data-driven so more apps can be added.

## 0.5.0

### Minor Changes

- [`617575d`](https://github.com/kimjh96/flemo/commit/617575d73c44b8ae2c3e704a7652aa8c5fc75f63) Localize the playground in full — the music-app chrome and the developer panel labels and descriptions now follow the docs locale, rendering in Korean when the playground is opened from the Korean site. Reword the docs intro so it no longer frames flemo as wiring a router and a motion library together. Sweep the Korean docs for awkward translations — fix loanword spellings, grammar, and literal calques, and close a few content gaps against the English source.

## 0.4.0

### Minor Changes

- [`237abd6`](https://github.com/kimjh96/flemo/commit/237abd64abeb90473557d1c46c99865329c03d30) Add six custom playground transitions, selectable from the transition picker. Four are pure `createTransition` demos — `zoom` (cross-zoom dive), `card-stack` (iOS sheet present with a receding backdrop), `reveal` (clip-path iris that opens to just cover the viewport), and `spring` (overshooting bounce). Two more co-design the transition motion and a custom `createDecorator` layer as one idea: `ripple` (a circular clip-path reveal with concentric rings radiating from the same origin) and `dive` (the screen rushes in from a point while the backdrop scales out into a closing dark tunnel).

## 0.3.1

### Patch Changes

- [`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f) `useNavigate().pop` now accepts a `transitionName` to override the back animation — handy when collapsing several screens with `skip` / `until`, where the leaving top's own transition isn't the one you want. The override is applied in the same commit that starts the pop, so the original transition never paints a frame.
- Updated dependencies ([`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f)):
  - @flemo/core@1.3.0
  - @flemo/react@1.2.0
  - @flemo/react-layout@0.1.8

## 0.3.0

### Minor Changes

- [`7b182f2`](https://github.com/kimjh96/flemo/commit/7b182f2c535c0b3098a5785e74e348669c54f730) Rebuild the playground dev panel into categorized sections — transitions, shared bars (separate navigation/app bar toggles with a live presence read-out), a navigation-distance demo for `{ skip }` / `{ until }`, performance, and a live inspector showing flemo's history stack, navigation status, and shared-bar registry in real time.

### Patch Changes

- [`dc46626`](https://github.com/kimjh96/flemo/commit/dc46626336d0a42946b7d35905c83461057d5427) Docs: document the `skip` / `until` options in the Navigation options table, add a `useScreen` return-shape reference to the API page, expand the Screen safe-areas guidance for native/hybrid (WebView) apps — let the web own the safe areas via `statusBarHeight` / `systemNavigationBarHeight` while the native shell disables its own — and reframe the server-side rendering section away from Next.js, since flemo owns client-side history and doesn't compose with the Next.js App Router.

## 0.2.8

### Patch Changes

- [`6e26b1d`](https://github.com/kimjh96/flemo/commit/6e26b1d5efa650a1e20db4a702c25214c1788fe6) Tidy the playground to match the workspace conventions: add the missing `"use client"` directive to the interactive segment/toggle/transition-picker components, drop decorative box-shadows in favor of the 1px-border design-system rule, move the bottom-sheet scrim and phone-frame ring onto theme tokens, and return `albumById` as `Album | null`.

  Move the performance/benchmark controls out of the in-app Library screen into a dedicated card in the developer panel, so the music app preview (and the embedded landing hero) stays free of developer buttons.

- [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef) `useNavigate().pop`, `replace`, and `push` now take an optional distance — `{ skip }` (a number of screens) or `{ until }` (a route pattern) — to reach a screen below the top in a single transition. The skipped screens are removed without ever painting, so they never flash by.

  All three reach the same target (`{ skip: n }` is the screen `n` below the top; `{ until }` is the nearest match) and differ only there: `pop` lands on it, `replace` replaces it (the target and everything above become the new screen), and `push` keeps it and stacks the new screen on top.

  `{ skip }` clamps to the stack depth; an unmatched `until` is a no-op for `pop`/`replace` and a plain push for `push`. Plain `pop()` / `replace(path)` / `push(path)` are unchanged.

- Updated dependencies ([`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef)):
  - @flemo/react@1.1.0
  - @flemo/react-layout@0.1.7

## 0.2.7

### Patch Changes

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Fix the white flash on the landing page's HeroDemo while the playground iframe is still loading in dark mode. The phone-frame interior and the loading-dot panel now use `var(--color-surface)` instead of a hardcoded `bg-white`, so they track the active theme and the iframe transitions in over a matching backdrop.
- Updated dependencies:
  - @flemo/react@1.0.6
  - @flemo/react-layout@0.1.6

## 0.2.6

### Patch Changes

- [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93) Add a "Perf scenarios" section to the playground's Library screen that pushes a synthetic Heavy Arrival screen with adjustable render-body CPU and tree size. Backs the new `heavy-screen.spec.ts` A/B harness measuring flipLatency, rAF cadence, and `long-animation-frame` entries with and without the compositor isolation hints.
- Updated dependencies ([`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93)):
  - @flemo/react@1.0.5
  - @flemo/react-layout@0.1.5

## 0.2.5

### Patch Changes

- [`541c526`](https://github.com/kimjh96/flemo/commit/541c52604f5a3d2f8c2257f09c1ba731b80a0c54) Update the API reference table so the `createDecorator` row reflects the four-slot signature (`initial / idle / enter / exit`). The previous "six-phase" label was already a copy-paste from `createTransition` and is doubly stale now that `createDecorator` requires `idle`.

## 0.2.4

### Patch Changes

- Updated dependencies ([`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2)):
  - @flemo/react@1.0.4
  - @flemo/react-layout@0.1.4

## 0.2.3

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.

- [`077cf72`](https://github.com/kimjh96/flemo/commit/077cf727bc41db8d6954b4aee331783ea035daba) Reframe the playground transitions panel: by default each push uses the transition that fits its own affordance (cupertino for browse-deeper hops, material for the player), set inline at every call site — there's no "harmonized" meta-option. The picker still exposes Built-in (cupertino / material / none) and Custom (blur) chips, but selecting one now **overrides** every push for comparison; tapping the active chip again drops back to the per-context default. The `resolvePushTransition` helper and its `_utils` folder are gone — the right model is "each navigation composes its own transition," not "a global resolver picks one." The code peek mirrors this: by default it shows the inline-per-site snippet, and only switches to a single `createTransition` source when an override is active.
- Updated dependencies ([`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937), [`077cf72`](https://github.com/kimjh96/flemo/commit/077cf727bc41db8d6954b4aee331783ea035daba)):
  - @flemo/react@1.0.3
  - @flemo/react-layout@0.1.3

## 0.2.2

### Patch Changes

- [`ee88080`](https://github.com/kimjh96/flemo/commit/ee8808088daee670a2601caa5a2bf52c0ccc1388) Unify the Korean docs voice to 해요체. The `layout-screen.ko.mdx` page mixed `~합니다` / `~입니다` (formal polite) with `~해요` / `~이에요` (informal polite) sentence endings on a per-paragraph basis; every other Korean docs page was already 해요체 throughout. Converted all 32 occurrences to 해요체 across `layout-screen.ko.mdx` and one straggler in `screen.ko.mdx`, including the headings that quote a hypothetical user's complaint ("모프가 일어나지 않고 페이드만 됩니다" → "...페이드만 돼요" etc.) so the voice stays consistent on every line.

- [`ee88080`](https://github.com/kimjh96/flemo/commit/ee8808088daee670a2601caa5a2bf52c0ccc1388) Fix the Pretendard Variable font 404. The previous URL pointed at `cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable.woff2` — but jsdelivr's `gh/` endpoint started returning 404 for this path, and the file was also reorganized: in `pretendard@1.3.9` the variable WOFF2 lives under a `woff2/` subdirectory (`dist/web/variable/woff2/PretendardVariable.woff2`), not directly in `dist/web/variable/`. Switched the URL to the npm-published `pretendard@1.3.9` via jsdelivr at the correct path. Verified `HTTP 200` with `content-type: font/woff2`.
- Updated dependencies ([`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350), [`3e883cc`](https://github.com/kimjh96/flemo/commit/3e883cc9798f30de180ea35efaed4e32523cd350)):
  - @flemo/react@1.0.2
  - @flemo/react-layout@0.1.2

## 0.2.1

### Patch Changes

- [`b9bc200`](https://github.com/kimjh96/flemo/commit/b9bc2004527b7821f74d11c487aa8cea85dc7d44) Rebrand the LayoutScreen status pill from "Beta" to "Experimental" — the API is gated on the motion-free FLIP migration rather than a release-train milestone, and "Beta" implied "GA is next" which doesn't match intent. The frontmatter flag is now `experimental: true` (was `beta: true`); the docs title and sidebar entry share one `ExperimentalPill` component for visual consistency. The LayoutScreen install snippet was also removed from the README so the README stays focused on the stable surface.

- [`af7d457`](https://github.com/kimjh96/flemo/commit/af7d457609655c331131f3264d32163645e5f09a) Make `harmonized` the default playground transition: cupertino for browse-deeper hops (Library / Search → Album) and material for the player (which closes with a downward chevron, so push and dismiss share one vertical axis). The transition picker now groups options as Default / Built-in / Custom — `blur` lives in Custom so it's clearly authored in the playground, not shipped from @flemo/core. Force-override any preset with a single click; the code peek shows the resolver rule when harmonized, or the `createTransition` source when forced.

- [`f5111b6`](https://github.com/kimjh96/flemo/commit/f5111b60cbe1183c1ede88a83ee11e602bcf95e4) Restructure the NowPlaying screen to drive Up Next / Lyrics through a bottom sheet instead of in-screen tabs — semantically a closer match for `useStep`, since the sheet's open state is URL/back-button reversible. The "Up Next" and "Lyrics" buttons each `pushStep` to open the sheet; the trailing swap chip inside the sheet uses `replaceStep` to flip contents in place without a close/reopen; the X button (or the system back button) `popStep`s the sheet shut. Album details are now shown inline by default — no toggle — so the screen leads with the artwork and the information you'd want at a glance. First playground surface that exercises every useStep verb in a flow that actually matches how a music app would model these affordances.

- [`9643b96`](https://github.com/kimjh96/flemo/commit/9643b96de103cd6569a8256e1a05719aeb7ebb82) Triple the playground music catalog so the demo screens actually scroll. The Library albums grid jumps from 6 to 18 entries, the Songs list shows up to 60 tracks, and Search's empty-state "Top Picks" surfaces all 18 albums instead of capping at 6. Lets visitors feel push/pop, swipe-back, and shared-bar behavior on screens that have real content beneath them.
- Updated dependencies ([`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb)):
  - @flemo/react@1.0.1
  - @flemo/react-layout@0.1.1

## 0.2.0

### Minor Changes

- [`f7ff70b`](https://github.com/kimjh96/flemo/commit/f7ff70bd3b5a09a9204b73c523e6e457d2886ef9) - Split the `LayoutScreen` section out of the Screen page into a dedicated docs entry with a deeper walkthrough — when to reach for it, the four-piece mental model (`transitionName: "layout"`, `layoutId`, `<LayoutConfig>`, `<LayoutScreen>`), why each piece exists, common patterns, expanded pitfalls, and when to skip morphing entirely.

- [`f834d4d`](https://github.com/kimjh96/flemo/commit/f834d4dae3088dd01c8385609987268aad99b03f) - Rebuild the playground from scratch around a minimal music-player demo: Library / Search tabs with a shared mini-player + tab-bar (`sharedNavigationBar`), Album detail with track list, and a Now Playing screen reached via `<LayoutScreen>` + `<LayoutConfig>` that morphs the album artwork from the source. Below the phone frame, a toggle panel swaps the Library → Album push transition (layout / cupertino / material / none) and toggles the shared bar so the difference is felt directly. The previous commerce demo is removed in favor of standalone, embed-friendly screen and bar units that can be lifted into individual docs pages in a later pass.

### Patch Changes

- Updated dependencies [[`1aef7de`](https://github.com/kimjh96/flemo/commit/1aef7de948d0a9edce6b48419558e468226c9eb4), [`819fa1f`](https://github.com/kimjh96/flemo/commit/819fa1f0ee75ff1540b79b811ff6953eeff3bc20), [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44), [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335), [`3a727cb`](https://github.com/kimjh96/flemo/commit/3a727cb2bf589147a1a7759a7a1f9e99b28d7926), [`58c930b`](https://github.com/kimjh96/flemo/commit/58c930bfcd30874f072d2567d255d2e283fe08f6), [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616), [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58)]:
  - @flemo/react@1.0.0
  - @flemo/react-layout@0.1.0
