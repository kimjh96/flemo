// Declared beside the transition it names, which is what the docs ask for:
// "Declare RegisterTransition, RegisterDecorator, and RegisterPartTransition
// the same way, in the file where you create each one."
declare module "@flemo/react" {
  interface RegisterTransition {
    drift: "drift";
  }
}

export {};
