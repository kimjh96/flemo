// Routes for the playground fixture. Namespaced under /playground so they never
// collide with the shell's routes in the global route registry.
declare module "@flemo/react" {
  interface RegisterRoute {
    // The gallery's own step params. A step is a sub-state of the SCREEN, so
    // it is surfaced through the same params the route carries and read back
    // with `useParams` — `useStep`'s own `step` is for chrome outside a screen.
    "/playground/gallery": { filter?: boolean };
    "/playground/gallery/:id": { id: string };
  }
}

export {};
