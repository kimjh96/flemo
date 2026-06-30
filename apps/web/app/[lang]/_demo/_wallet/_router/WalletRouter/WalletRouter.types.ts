// Routes for the wallet demo. All namespaced under /wallet so they never
// collide with the playground or shell entries in the shared global
// `RegisterRoute`. This Router is nested, so the paths are local-only (in-memory
// history) and never reach the browser URL.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/wallet/home": Record<string, never>;
    "/wallet/activity": Record<string, never>;
    "/wallet/tx/:id": { id: string };
    "/wallet/send": Record<string, never>;
  }
}

export {};
