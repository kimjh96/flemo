// RegisterRoute augmentations live alongside each screen (e.g.
// `LibraryScreen/LibraryScreen.routes.ts`). The screen file side-effect imports
// its own `*.routes.ts`, so when the screen is loaded its path contract is
// registered into `@flemo/react`'s route map and the union merges across
// screens via interface declaration merging.
declare module "@flemo/react" {
  interface RegisterTransition {
    breathe: "breathe";
    blur: "blur";
    "slide-left": "slide-left";
    "slide-right": "slide-right";
    zoom: "zoom";
    "card-stack": "card-stack";
    reveal: "reveal";
    spring: "spring";
    spotlight: "spotlight";
    sheet: "sheet";
    swoosh: "swoosh";
  }

  interface RegisterDecorator {
    vignette: "vignette";
    frost: "frost";
    scrim: "scrim";
  }
}

export {};
