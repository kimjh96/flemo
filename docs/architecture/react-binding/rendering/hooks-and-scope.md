# Hooks and scope coordination

- Navigation: `useNavigate`, `usePathname`, `useStep`.
- Screen identity/role: `useScreen`.
- Parameters: `useParams`.
- Store hooks: `useHistoryStore` and others use zustand selectors over the scope bundle.
- Keyboard detection: `useViewportScrollHeight` hides bottom chrome.

`scopeAnimHoldCoordinator.ts` provides a per-scope coordinator singleton in a WeakMap keyed by the navigate store. Nested Routers must never share a pop pair-release group.
