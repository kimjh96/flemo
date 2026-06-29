// Route for the docs content area. Nested Router whose paths are composed under
// the shell's /docs route (/docs/:slug is a real server route), so deep-links
// and refreshes resolve.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/docs/:slug": { slug: string };
  }

  interface RegisterTransition {
    "doc-step-forward": "doc-step-forward";
    "doc-step-backward": "doc-step-backward";
  }
}

export {};
