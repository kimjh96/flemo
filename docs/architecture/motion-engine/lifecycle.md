# Flight lifecycle

`ScreenMotion.tsx` renders declarative state; `createTransitionEngine.ts` and `driveScreenLifecycle` own imperative behavior.

- [Hold and park before release](lifecycle/hold-and-release.md): render-time holds, parking, readiness, and clock anchoring.
- [Release and flight](lifecycle/flight.md): flight startup, cold-side protection, and participant preparation.
- [Perceptual cut and early landing](lifecycle/perceptual-landing.md): imperceptibility criteria and recovery exclusions.
- [Completion and layer settle](lifecycle/completion.md): resolution, cleanup, hold release, and compositor demotion.
