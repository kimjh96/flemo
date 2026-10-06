# (a) Symptom taxonomy

Distinguish the Korean terms used in reports before diagnosing motion.

## 수렴 떨림 / 지글거림 / 시머 — convergence tremor / sizzle / shimmer

A spatial slow-tail artifact: sub-pixel bilinear resampling washes texture or glyph antialiasing at fractional layer offsets, dither grain slides, or the display pipeline contributes an effect. Frame timing is usually perfect; rAF and trace metrics cannot see it. Use pixel probes such as screenshot energy or visual inspection.

First checks: viewing configuration, emulation, HiDPI scaling, dpr, snap policy, and a pure-CSS control page.

## 버벅(임) — stutter / jank (frame time)

A temporal artifact from missed or uneven presented frames. Possible causes include player main-thread famine, compositor raster stalls, GPU pipeline compilation, and browser present pacing.

First checks: `__flemoPlayerGaps`, a trace with non-forcing categories, and the routed driver.

## 씹힘 — swallowed opening

The first 0–70% of the transition is not presented. A mount/release commit may block a wall-clocked animation until its opening has aged away, or content may paint late into an already-moving container, as in Note 9 mode.

First checks: driving tier, hold/park state, and settle-gate engagement.

## 휙휙 — whoosh / rushed opening

Distinct from 씹힘, as the user defined on 2026-08-12: 0→60% appears as sparse, rushed frames because early load drops coarsely sample wall-clock playback's fast segment. The player's capped clock is structurally immune through load-adaptive time dilation; a wall-clocked compiled animation cannot provide that property by specification.

First check: driver. A pure-CSS mount-and-start-in-one-commit reproduction exhibits this without flemo code.

## 드르륵 / 계단 — stepping / quantization

Integer snapping turns slow tracked motion of ≤1 device px per frame into stalls followed by steps. This is shimmer's physical opposite: the slow tail must accept fractional-blur sizzle or integer stepping. Both were judged on devices; the velocity-gate default is the reachable floor.

First checks: `flemo:snap` override and dpr.

## 멈췄다 휙 — freeze-then-leap

A mid-transition freeze followed by a catch-up jump. A wall-clocked animation may survive a main-thread block; historically, an animation born mid-transition could desynchronize WebKit's accelerated resynchronization.

First checks: chain state, driver, and mid-transition suspense commits.
