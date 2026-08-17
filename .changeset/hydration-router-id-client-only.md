---
"@flemo/react": patch
---

Emit `data-flemo-router` only after hydration so the router marker can't cause a hydration mismatch. The id comes from `useId`, whose value encodes the component's position from the hydration root; a consumer whose server render root differs from its client hydrate root (e.g. SSR renders `<Html><App/></Html>` but the client hydrates just `<App/>` at `#root`) produces a different id on each side, surfacing as a mismatch on the one flemo attribute that reaches the DOM. The engine only reads the attribute client-side, so it is now withheld until mount — server and first client render both emit nothing (a match), and an effect exposes it once hydrated.
