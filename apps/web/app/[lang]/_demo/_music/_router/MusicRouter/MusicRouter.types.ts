// Routes for the music mini-app. Namespaced under /music so they never collide
// with the shell's "/" in the global route registry.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/music": Record<string, never>;
    "/music/playing/:id": { id: string };
  }
}

export {};
