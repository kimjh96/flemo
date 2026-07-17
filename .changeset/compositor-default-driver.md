---
"@flemo/core": patch
---

Make the compiled-CSS compositor the default screen-transition driver on every engine. A main-thread rAF player shares its thread with the consumer's work, and a real transition window routinely carries a query-refetch or suspense commit — measured under CPU throttle, the player collapsed 150ms fades into 1-2 frames while the compositor played them on time through 300ms stalls. The player remains available behind the `flemo:motion-driver-force` pin, now with a health-gated takeover for programmatic opt-ins.
