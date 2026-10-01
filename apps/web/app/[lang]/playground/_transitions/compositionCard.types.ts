import "@flemo/core";

declare module "@flemo/core" {
  interface RegisterPartTransition {
    "composition-card-copy": "composition-card-copy";
  }

  interface RegisterMorphTransition {
    "composition-card-shell": "composition-card-shell";
  }
}
