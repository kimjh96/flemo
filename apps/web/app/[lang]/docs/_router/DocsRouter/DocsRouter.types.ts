// The docs Router's route and transitions. Its paths compose under the shell's
// /docs route (/docs/:slug is a real server route), so deep links and refreshes
// resolve.
declare module "@flemo/react" {
  interface RegisterRoute {
    // `nav` is a useStep param: on a phone the page list opens as a sheet
    // through a history step, so Back closes it without leaving the page.
    "/docs/:slug": { slug: string; nav?: boolean };
  }

  interface RegisterTransition {
    "doc-forward": "doc-forward";
    "doc-backward": "doc-backward";
  }
}

export {};
