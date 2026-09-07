// Declared beside the part transition it names. One name for every case: the
// clock is the flight's, so the part does not need to know which flight.
declare module "@flemo/react" {
  interface RegisterPartTransition {
    "detail-chrome": "detail-chrome";
  }
}

export {};
