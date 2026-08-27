// The mini-app's routes. One nested Router with its own in-memory stack, so the
// bench never touches the site's URL or the browser's back button.
//
// `sheet` on the list is a STEP, not a screen: "A step is a sub-state pushed
// onto history without stacking a new screen (a param change)". It is what a
// bottom sheet actually is, and it means back closes the sheet before it leaves
// the screen, for free.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/tonight": { sheet?: boolean };
    "/tonight/tickets": Record<string, never>;
    "/tonight/act/:id": { id: string };
  }
}

export {};
