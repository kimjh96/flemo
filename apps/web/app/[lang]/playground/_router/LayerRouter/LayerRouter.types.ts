// Routes for the layering fixture. Namespaced under /playground so they never
// collide with the shell's routes in the global route registry.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/playground/layer": Record<string, never>;
    "/playground/layer/away": Record<string, never>;
    "/playground/layer/a": Record<string, never>;
    "/playground/layer/b": Record<string, never>;
  }
}

export {};
