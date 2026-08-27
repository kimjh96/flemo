// The mini-app's routes. One nested Router with its own in-memory stack, so the
// bench never touches the site's URL or the browser's back button.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/tonight": Record<string, never>;
    "/tonight/tickets": Record<string, never>;
    "/tonight/act/:id": { id: string };
  }
}

export {};
