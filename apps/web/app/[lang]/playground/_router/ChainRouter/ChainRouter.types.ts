// Routes for the chain fixture. Namespaced under /playground so they never
// collide with the shell's routes in the global route registry.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/playground/nest": Record<string, never>;
    "/playground/chain/:step": { step: string };
  }
}

export {};
