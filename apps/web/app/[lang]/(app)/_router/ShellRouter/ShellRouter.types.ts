// Route + transition contracts for the flemo app shell.
//
// `RegisterRoute` is a SINGLE global registry shared across every flemo app in
// this project (the playground and this shell both augment it via declaration
// merging). The playground already registers `"/"`, so we must NOT redeclare it
// here — declaration merging errors on a differently-typed duplicate key, and a
// conflicting redeclaration would also break the playground's own `"/"` screen.
// The shell reuses that existing `"/"` entry (its `HomeScreen` takes no params)
// and only contributes the new `"/showcase"` path. Runtime stays isolated: each
// Router matches only its own <Route> children; the registry is type-only.
//
// (When the shell is promoted to own `/` for real, the shared `"/"` registry
// will need reconciling with the playground — tracked as part of the web
// overhaul.)
declare module "@flemo/react" {
  interface RegisterRoute {
    "/showcase": Record<string, never>;
  }

  interface RegisterTransition {
    "shared-axis-forward": "shared-axis-forward";
    "shared-axis-backward": "shared-axis-backward";
  }
}

export {};
