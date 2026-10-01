# Routing and ownership

## Router tree

Each `Router` owns one screen stack, transition catalog, gesture lifecycle, and flight boundary. A nested Router owns a contained region and separate stack. Nesting controls rendering scope; `history="browser"` or `history="memory"` independently controls whether the stack uses the URL.

Before implementation, write a small table:

| Router | Parent | History | Paths | Slot box | Persistent chrome |
| --- | --- | --- | --- | --- | --- |
| app | none | browser | `/`, `/detail/:id` | viewport | none |
| pane | app | memory | `/list`, `/filters` | content panel | pane toolbar |

Give a Router a stable `name` when a descendant may navigate a different stack. Names must be unique along an ancestor chain.

## Target resolution

Navigation targets resolve from where `useNavigate` was called.

| Target | Result |
| --- | --- |
| omitted or `current` | nearest enclosing Router |
| `parent` | one Router outward |
| `root` | outermost Router in the current chain |
| `nearest-owner` | first current-or-ancestor Router declaring the destination path |
| a Router name | matching Router in the current-or-ancestor chain |

Resolution never crosses into a sibling Router. `nearest-owner` requires a path and cannot infer an owner for `pop()`. For a cross-Router pop, create a navigator with an explicit target, such as `useNavigate({ router: "app" })`.

`RegisterRoute` proves a path exists somewhere in the application, not that the selected Router owns it. Prefer explicit targets for cross-Router moves and enable `strictRoutes` while developing unfamiliar topology.

## Slot and chrome choices

- Without a `Slot`, the Router's children are its route declarations and the root Router uses the viewport.
- With a `Slot`, only routes inside it form the moving screen region. Size the Slot explicitly.
- Put chrome outside the Slot only when the same mounted instance and content persist across every route in that Router.
- Use matching `sharedTopBarId` or `sharedBottomBarId` values when each Screen owns different bar content but the bar should hand over in place.
- Use per-screen `topBar` or `bottomBar` when the entire bar should enter and leave with its Screen.

For a stable-looking app header with a changing title and left action, render the same header shell from each Screen as `sharedTopBar`, give the bars the same ID, and wrap the changing title and action in Parts. The two screen-owned sides can then hand off and scrub on pop.

## Ownership boundary checks

- Register screen, Part, Morph, and decorator transitions on the Router whose flight uses them.
- A Part in nested Router chrome but inside an outer Screen belongs to that enclosing outer Screen's flight.
- A Morph inside a nested Screen belongs to the nested Router. Do not assume it can pair with a Morph on an ancestor Router's destination screen.
- Use separate identities for separate visual objects, even when their text or icon matches.
