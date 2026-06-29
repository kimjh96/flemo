---
"@flemo/react": minor
"@flemo/core": minor
---

Add a per-Router `history` prop (`"browser"` default, `"memory"` opt-in) that decouples the history backend from nesting. A nested `<Router>` now participates in browser back/forward by default, while `history="memory"` keeps its previous isolated in-memory stack. Browser Routers namespace their `window.history.state` by a stable key and use a per-Router self-pop guard so multiple browser Routers coexist without clobbering each other.
