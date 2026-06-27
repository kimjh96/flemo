// The screen store is framework-neutral and now lives in @flemo/core alongside
// the history and navigate stores. Re-exported here so the React-side
// `@screen/store` import sites stay unchanged.
export { createScreenStore as default } from "@flemo/core";
export type { ScreenStore, ScreenStoreApi, SharedBarPresence } from "@flemo/core";
