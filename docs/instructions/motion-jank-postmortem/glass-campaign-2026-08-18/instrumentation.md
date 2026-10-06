# Campaign instrumentation and measurement traps

## Instrumentation

The campaign used display capture (CFR/AVFoundation, VFR/QuickTime), badge markers (transition window / release colour inversion), a pose encoder (greyscale progress recording), CDP traces (presentation feedback), and displacement cross-correlation profiles.

## Measurement traps

- **mtime-based capture alignment is biased ±300–600ms.** Never claim absolute times from it; only differential structure within a transition is valid. Corner colour-inversion markers are the only zero-bias sync.
- **VFR recording (screencapture/QuickTime) produces approximately 2.4 periodic fake gaps per second.** Do not count gaps without baseline subtraction; this was reconfirmed against the Safari control.
- **Display capture is an observer.** The capture client forces WindowServer to composite every vsync and suppresses the symptom, confirmed by user-independent observation. A capture-time verdict describes a mitigated state.
- **Offscreen or partially occluded window measurements are contaminated.** A coordinate mistake put many “clean” drive measurements offscreen. Window coordinates must remain within the display width.
- **`evaluate().click()` does not fire pointerdown.** Verification bypassing the pointerdown-armed machinery is not verification. Use real input through `page.mouse`.
- **Absolute stall comparisons across different window geometries are invalid.**
