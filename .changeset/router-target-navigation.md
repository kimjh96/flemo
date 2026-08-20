---
"@flemo/react": minor
"@flemo/web": patch
---

Let a navigation choose which Router it runs on. Give a `<Router>` a `name` and target it
from anywhere inside it: `useNavigate({ router: "app" })` binds every call, and
`push(path, params, { router: "app" })` overrides per call, alongside the relative targets
`current`, `parent`, `root` and `nearest-owner`. A nested Router's screen can now open a
full-screen route on the Router above it instead of transitioning inside its own `Slot`,
with the selected Router's history, transition and gestures driving from the first frame.
Router names are type-checked through a `RegisterRouter` augmentation, the same way routes and
transitions are: register them and an unknown `router` target becomes a compile error, leave the
registry empty and any name still works. Navigating to a route the target Router does not declare is now reported in development
(an error for an explicit target, a warning otherwise, or an error everywhere with the new
`strictRoutes` prop) instead of silently producing an empty transition.
