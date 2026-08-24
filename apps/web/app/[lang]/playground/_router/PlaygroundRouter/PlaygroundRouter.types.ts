// Routes for the playground fixture. Namespaced under /playground so they never
// collide with the shell's routes in the global route registry.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/playground/gallery": Record<string, never>;
    "/playground/gallery/:id": { id: string };
  }
}

export {};
