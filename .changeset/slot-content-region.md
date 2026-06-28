---
"@flemo/react": minor
---

Add `<Slot>`: mark where the screen stack renders inside a layout. Put your `<Route>`s in a `<Slot>` and lay the rest of the screen (sidebar, header, footer) around it — only that region transitions between routes while everything outside it persists. It stays one `<Router>`, one history, one `navigate`, so a sidebar's `useNavigate` drives the region with no extra wiring.
