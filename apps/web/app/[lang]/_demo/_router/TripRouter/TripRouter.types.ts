// The routes of the composition demo: the app's own stack, and the stack of
// the panel nested inside its home screen. Both run on memory history, so the
// demo never touches the site's URL or the browser's back button.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/trip": Record<string, never>;
    "/trip/:id": { id: string };
    "/panel": Record<string, never>;
    "/panel/filters": Record<string, never>;
  }

  interface RegisterRouter {
    trip: true;
    panel: true;
  }
}

export {};
