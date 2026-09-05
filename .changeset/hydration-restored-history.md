---
"@flemo/core": patch
"@flemo/react": patch
---

Keep a hydrating Router's first render equal to the server's. A Router adopts
the identity of the browser entry it mounted on, so a traversal back onto that
entry matches by id rather than colliding with every other scope's generic
"root". That adoption reads `window.history.state`, which the server cannot see,
and it ran inside the store initializer, which for a hydrating tree is the one
render that must agree with the server HTML.

`history.state` survives a reload, so a refresh on a page that had pushed seeded
a generated id where the server had written "root". React does not patch a
mismatched attribute, so the DOM kept `data-flemo-screen="root"` while the store
believed the other one, leaving the engine and the document disagreeing about
which screen this is for the life of the page. Reported from a browser as a
console error after refreshing the home page; reproduced by navigating out of a
nested Router's zone and back before reloading.

The adoption is now deferred to the commit after hydration, so the first render
matches and the entry's identity still arrives. `createRouterScope` takes
`deferEntryAdoption` and core exports `adoptEntryIdentity` for a binding to call
once hydration is over; a scope created later on the client still adopts in the
same render, as before.
