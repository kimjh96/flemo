// Route contract for the hero's shiflo viewer. A single param route holds the
// shot index; flemo slides between values of `n` on the shared axis. The path is
// namespaced (`/shiflo-shot/...`) so it never collides with the playground or
// shell entries in the shared global `RegisterRoute`. This Router is nested, so
// the path is local-only (in-memory history) and never reaches the browser URL.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/shiflo-shot/:n": { n: string };
  }
}

export {};
