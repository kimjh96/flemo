// Route + transition contracts for the flemo app shell. RegisterRoute is a
// single global registry; the shell owns the marketing paths, and the nested
// The nested docs Router contributes its own namespaced paths.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/": Record<string, never>;
    "/showcase": Record<string, never>;
    "/playground": Record<string, never>;
    "/docs": Record<string, never>;
  }

  interface RegisterTransition {
    "shared-axis-forward": "shared-axis-forward";
    "shared-axis-backward": "shared-axis-backward";
    "docs-enter": "docs-enter";
  }
}

export {};
