---
"@flemo/core": minor
---

Accept any CSS easing where a transition takes one, and say so when a name
resolves to nothing. `AnimationEasing` has always been typed as a string, but
only nine motion-style names were understood: everything else, including
`ease-out`, `cubic-bezier(...)`, `steps(...)` and the `linear(...)` form a
spring ships as, compiled to `ease` without a word. The keyframes compiler and
the curve sampler now read one shared table, pass CSS easings through, and warn
once in development for a name neither knows.

`AnimationEasing` also offers what it accepts rather than taking any string:
the named eases, the CSS keywords and the functional forms are a union derived
from that same table, so an editor completes them. It keeps a `string` arm, so
nothing existing stops compiling and a computed easing is still possible.
