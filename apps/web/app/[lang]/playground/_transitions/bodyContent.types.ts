// One body part per screen transition. See `clocks.ts`.
declare module "@flemo/react" {
  interface RegisterPartTransition {
    "body-cupertino": "body-cupertino";
    "body-material": "body-material";
    "body-layout": "body-layout";
    "body-none": "body-none";
    "body-fade": "body-fade";
    "body-sheet": "body-sheet";
  }
}

export {};
