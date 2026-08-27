// One bar part per screen transition, so `<Part name={barPartFor(id)}>` has a
// registered name for every row of the clock table. See `clocks.ts` for why the
// bar's contents cannot share a single clock across presets.
declare module "@flemo/react" {
  interface RegisterPartTransition {
    "bar-cupertino": "bar-cupertino";
    "bar-material": "bar-material";
    "bar-layout": "bar-layout";
    "bar-none": "bar-none";
    "bar-fade": "bar-fade";
    "bar-sheet": "bar-sheet";
  }
}

export {};
