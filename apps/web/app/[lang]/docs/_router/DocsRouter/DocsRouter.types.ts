// Route for the docs content area. Nested Router whose paths are composed under
// the shell's /docs route (/docs/:slug is a real server route), so deep-links
// and refreshes resolve.
declare module "@flemo/react" {
  interface RegisterRoute {
    // `nav` is a flemo `useStep` param: on mobile the sidebar opens as a sheet
    // through a history step, so Back/close pops it (the same pattern as the
    // playground source panel's `code`).
    "/docs/:slug": { slug: string; nav?: boolean };
  }

  interface RegisterTransition {
    "doc-step-forward": "doc-step-forward";
    "doc-step-backward": "doc-step-backward";
  }
}

export {};
