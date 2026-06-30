import "@testing-library/jest-dom/vitest";

// jsdom ships no ResizeObserver; shared bars observe their own height to keep a
// CSS spacer in sync, so any test that renders a Screen with a bar needs a stub.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}
