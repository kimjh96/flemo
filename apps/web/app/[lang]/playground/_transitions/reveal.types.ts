// Declared beside the transition it names, which is what the docs ask for:
// "prefer declaring each route at the bottom of the file that defines its
// screen ... Declare RegisterTransition, RegisterDecorator, and
// RegisterPartTransition the same way, in the file where you create each one."
declare module "@flemo/react" {
  interface RegisterTransition {
    reveal: "reveal";
  }
}

export {};
