# Composition patterns

## Shared header plus nested navigation

This pattern combines a root screen stack, a local memory stack, a visually continuous app header, independently animated header contents, and explicit cross-Router navigation.

```tsx
import { useState, type ReactNode } from "react";

import {
  Layer,
  Morph,
  Part,
  Route,
  Router,
  Screen,
  Slot,
  createPartTransition,
  useNavigate
} from "@flemo/react";

const ARRIVE = [0.4, 0, 1, 1] as const;
const LEAVE = [0, 0, 0.2, 1] as const;
const FLIGHT_EASE = [0.32, 0.72, 0, 1] as const;

const headerTitle = createPartTransition({
  name: "header-title",
  initial: { opacity: 0, x: 72 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  enter: { value: { opacity: 0, x: -72 }, options: { ease: FLIGHT_EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  dismiss: { value: { opacity: 0, x: 72 }, options: { ease: FLIGHT_EASE } }
});

const headerAction = createPartTransition({
  name: "header-action",
  initial: { opacity: 0, x: 12 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  enter: { value: { opacity: 0, x: -12 }, options: { ease: FLIGHT_EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: FLIGHT_EASE } },
  dismiss: { value: { opacity: 0, x: 12 }, options: { ease: FLIGHT_EASE } }
});

const cardCopy = createPartTransition({
  name: "card-copy",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { ease: ARRIVE } },
  enter: { value: { opacity: 0 }, options: { ease: LEAVE } },
  exit: { value: { opacity: 1 }, options: { ease: ARRIVE } },
  dismiss: { value: { opacity: 0 }, options: { ease: LEAVE } }
});

function Header({ title, action }: { title: string; action: ReactNode }) {
  return (
    <header className="app-header">
      <Part name="header-action">{action}</Part>
      <Part name="header-title">
        <h1>{title}</h1>
      </Part>
    </header>
  );
}

export function AppRouter() {
  return (
    <Router
      name="app"
      strictRoutes
      defaultTransitionName="cupertino"
      partTransitions={[headerTitle, headerAction, cardCopy]}
    >
      <Route path="/workspace" element={<Workspace />} />
      <Route path="/message/:id" element={<Message />} />
    </Router>
  );
}

function Workspace() {
  const app = useNavigate({ router: "app" });
  return (
    <Screen
      sharedTopBar={<Header title="Inbox" action={<button>Menu</button>} />}
      sharedTopBarId="app-header"
    >
      <Morph
        name="shared"
        layoutId="featured-message"
        onClick={() => app.push("/message/:id", { id: "42" })}
      >
        <article>
          <Part name="card-copy">
            <small>Today</small>
          </Part>
          <span style={{ display: "block", height: 24 }}>
            <Morph
              as="span"
              name="text"
              layoutId="featured-message-title"
              style={{ display: "block", fontSize: 16, lineHeight: "24px" }}
            >
              Featured message
            </Morph>
          </span>
          <Part name="card-copy">
            <p>Open message</p>
          </Part>
        </article>
      </Morph>

      <Router name="pane" history="memory" initPath="/list" className="pane">
        <nav>Local tools</nav>
        <Slot className="pane-slot">
          <Route path="/list" element={<MessageList />} />
          <Route path="/filters" element={<Filters />} />
        </Slot>
      </Router>
    </Screen>
  );
}

function MessageList() {
  const pane = useNavigate();
  const app = useNavigate({ router: "app" });
  const [overlayOpen, setOverlayOpen] = useState(false);
  return (
    <Screen>
      <button onClick={() => pane.push("/filters")}>Local filters</button>
      <button onClick={() => app.push("/message/:id", { id: "7" })}>Full-screen message</button>
      <button onClick={() => setOverlayOpen(true)}>Open command layer</button>
      {overlayOpen && (
        <Layer>
          <div className="app-overlay" role="dialog" aria-modal="true">
            <button onClick={() => setOverlayOpen(false)}>Close</button>
          </div>
        </Layer>
      )}
    </Screen>
  );
}

function Filters() {
  return <Screen>Filters</Screen>;
}

function Message() {
  const app = useNavigate({ router: "app" });
  return (
    <Screen
      sharedTopBar={
        <Header title="Message" action={<button onClick={() => app.pop()}>Back</button>} />
      }
      sharedTopBarId="app-header"
    >
      <Morph name="shared" layoutId="featured-message">
        <article>
          <Part name="card-copy">
            <small>Message 42</small>
          </Part>
          <span style={{ display: "block", height: 32 }}>
            <Morph
              as="span"
              name="text"
              layoutId="featured-message-title"
              style={{ display: "block", fontSize: 24, lineHeight: "32px" }}
            >
              Featured message
            </Morph>
          </span>
          <Part name="card-copy">
            <p>Full message</p>
          </Part>
        </article>
      </Morph>
    </Screen>
  );
}
```

Matching header IDs pair the bars. The shell appears stationary while `header-title` and `header-action` cross-fade and translate as Parts. Omitted durations make both sides inherit the root screen clock. With no swipe hooks, root swipe-back automatically scrubs the same keyframes in both directions.

Local navigation uses the nearest `pane` Router; the full-screen button explicitly targets ancestor `app`. The source `Morph` sits outside the nested Router, so the root Screen owns it and it can pair with the root Message screen. Inside `MessageList`, it would belong to `pane` and should not be expected to join the root flight.

`MessageList` owns command-overlay state, but `Layer` portals its paint into the outermost Screen's layer host. It can cover the root shared header without changing either Router stack. Fixed or absolute edges resolve against that host, not the pane box. To keep the overlay inside the pane, omit `Layer` and render ordinary pane content.

The outer Morph owns the card's box and surface. The repeated title uses a nested `name="text"` Morph so one glyph run re-typesets between sizes. The text Morph is a transformable block that owns its font size and line height; its holder preserves the line's layout box while the runtime carries it. An inline text Morph can receive a computed `translate` that the browser does not apply to its line box, making text appear at its destination before travelling. Ordinary title content on both sides would cross-fade source and destination glyphs, visibly doubling letters during handoff.

The eyebrow and description are different copy, not shared identity. Their `card-copy` Parts make departure leave early and arrival enter late on the root clock. Do not wrap the text Morph in that Part: fading its parent would fade the glyph run that must remain continuously visible.

For projects using typed registries, add the usual module augmentation for route, Router, and transition names.

## Participant matrix for the pattern

| Participant        | Owner                            | Identity                                          | Push                                 | Pop                                       | Gesture                       | Layer                  |
| ------------------ | -------------------------------- | ------------------------------------------------- | ------------------------------------ | ----------------------------------------- | ----------------------------- | ---------------------- |
| root Screens       | app                              | route entries                                     | workspace behind, message arrives    | message dismisses, workspace returns      | screen transition             | app Slot               |
| header shell       | app Screens                      | shared bar ID `app-header`                        | hands over in place                  | hands over in place                       | shared bar choreography       | shared bar             |
| title and action   | app Screens                      | Part names                                        | old `enter`, new `initial` to `idle` | top `dismiss`, previous `enter` to `exit` | default Part rider            | part layer             |
| featured message   | app Screens                      | Morph `featured-message`                          | arrival flies, departure cuts        | returning arrival flies, top cuts         | Morph swipe runtime           | morph layer            |
| featured title     | outer message Morph              | Morph `featured-message-title` with `name="text"` | re-typesets inside card flight       | reverses inside card flight               | inherits carrying Morph clock | nested morph           |
| changing card copy | root Screens, inside outer Morph | Part `card-copy`                                  | departure leaves, arrival enters     | reverse handoff                           | default Part rider            | carrying Morph subtree |
| pane Screens       | pane                             | local routes                                      | only pane Slot changes               | only pane Slot changes                    | pane transition               | pane Slot              |
| command overlay    | list Screen state                | Layer slot owned by nested Screen                 | no navigation                        | no navigation                             | rides its owner if it moves   | outer Screen host      |

## Composition rules

- Give each element one clear motion owner. Avoid custom inline drag code around a screen-moving target unless the transforms are intentionally composed.
- Separate visual identity from semantic similarity: similar-looking headers need different shared bar IDs when they are different objects.
- Make the paint layer explicit when overlays cross bar or Slot boundaries.
- Keep route-local effects and state under their owning Router. Cross-Router navigation changes the target stack, not the source component's lexical ownership.
- Give a text Morph its own transformable box and typography. Use a fixed or otherwise stable holder if removing the box during flight would collapse surrounding layout.
- Morph same-identity content once; hand related copy off as Parts outside the text Morph.
