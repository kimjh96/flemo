import "@testing-library/jest-dom/vitest";

// jsdom ships no ResizeObserver; the @flemo/react screen runtime observes
// element sizes, so any test that mounts a Screen needs a stub.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}
