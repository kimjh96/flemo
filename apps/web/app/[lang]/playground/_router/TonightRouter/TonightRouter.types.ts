// The mini-app's routes. One nested Router with its own in-memory stack, so the
// bench never touches the site's URL or the browser's back button.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/tonight": Record<string, never>;
    "/tonight/posters": Record<string, never>;
    "/tonight/tickets": Record<string, never>;
    // `from` is not in the pattern, so it compiles into the query string:
    // "Params consumed by the pattern's tokens fill the path; the leftovers
    // become the query string." The detail needs it because the two tab
    // surfaces name their shared elements differently, and it has to pair with
    // whichever one opened it.
    "/tonight/act/:id": { id: string; from: "row" | "cell" };
  }
}

export {};
