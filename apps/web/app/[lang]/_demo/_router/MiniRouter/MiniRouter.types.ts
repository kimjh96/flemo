// The mini app's routes. One nested Router with its own in-memory stack, so a
// demo never touches the site's URL or the browser's back button.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/mini": Record<string, never>;
    "/mini/:id": { id: string };
  }
}

export {};
