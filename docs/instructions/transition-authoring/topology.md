# Router topology

Determine the navigation owner and visual boundary before choosing a transition factory. Motion belongs to the Router whose stack changes.

| Question | Rule |
| --- | --- |
| Which stack changes by default? | The nearest enclosing Router, `current`. |
| How does a child target an enclosing stack? | Use `parent`, `root`, `nearest-owner`, or an enclosing Router `name`. |
| Can a name target a sibling Router? | No. Resolution searches only the current Router and its ancestors. |
| Can `nearest-owner` select a Router for `pop()`? | No. A pathless pop has no route owner to infer; name the Router explicitly. |
| What remains mounted during a region's transition? | Everything outside that Router's `Slot`. |
| What does a nested Router own? | Its contained screen box and stack; `history="memory"` also isolates it from the URL. |

A persistent header outside a `Slot`, a shared bar supplied by each `Screen`, and a per-screen header inside the screen are distinct structures. Decide which owns the pixels before choosing `Part`, `Morph`, or a screen transition.

Keep literally identical, route-independent chrome outside the `Slot`. If a header's shell appears fixed but its title or actions vary by screen, render the bar from each `Screen` with the same shared bar identity, and wrap changing titles and actions in named `Part` elements.
