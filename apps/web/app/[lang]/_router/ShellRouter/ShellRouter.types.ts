// Route and transition contracts for the site shell. RegisterRoute is one global
// registry; the shell owns the section paths, and the nested docs Router adds
// its own (including "/docs/:slug", which the shell also matches).
declare module "@flemo/react" {
  interface RegisterRoute {
    "/": Record<string, never>;
    "/docs": Record<string, never>;
    "/playground": Record<string, never>;
    "/playground/composition": Record<string, never>;
    "/showcase": Record<string, never>;
  }

  interface RegisterTransition {
    "site-forward": "site-forward";
    "site-backward": "site-backward";
    "site-drill": "site-drill";
  }
}

export {};
