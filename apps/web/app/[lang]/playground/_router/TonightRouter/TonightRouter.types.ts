// The app's routes, typed. `useParams` and `useNavigate` read these, so a push
// to a path that does not exist, or with the wrong params, is a type error
// rather than a blank screen.
declare module "@flemo/react" {
  interface RegisterRoute {
    // The app's own stack: two tabs and one screen above them.
    "/tonight/home": Record<string, never>;
    "/tonight/tickets": Record<string, never>;
    "/tonight/seatmap/:id": { id: string };
    // The nested stack inside the Home tab. `filter` is a STEP — a sub-state of
    // the listings screen, pushed with `useStep` and read back with
    // `useParams`, which stacks no screen.
    "/browse/acts": { filter?: boolean };
    "/browse/act/:id": { id: string };
  }
}

export {};
