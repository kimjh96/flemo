// The booking flow's one route, parameterised by step. One Route rather than
// five: every step is the same screen with a different row of the table behind
// it, so five Route entries would only be five ways to say the same thing.
declare module "@flemo/react" {
  interface RegisterRoute {
    "/booking/:step": { step: string };
  }
}

export {};
