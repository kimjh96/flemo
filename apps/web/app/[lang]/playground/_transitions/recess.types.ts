// Declared beside the decorator it names. Without this the `decoratorName` on
// `drift` is a string the compiler has never heard of.
declare module "@flemo/react" {
  interface RegisterDecorator {
    recess: "recess";
  }
}

export {};
