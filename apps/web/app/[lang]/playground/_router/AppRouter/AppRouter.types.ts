// The fixture app's routes. Two levels, registered together because
// RegisterRoute is one global registry: the OUTER Router owns the tabs, the
// nested one inside the Browse tab owns its own stack.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/studio/browse": Record<string, never>;
    "/studio/saved": Record<string, never>;
    "/browse/list": { filter?: boolean };
    "/browse/piece/:id": { id: string };
    "/browse/viewer/:id": { id: string };
  }
}

export {};
