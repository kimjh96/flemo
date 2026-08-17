// Node >= 22 ships experimental global `localStorage`/`sessionStorage` that
// read as `undefined` unless --localstorage-file is passed. In the vitest
// jsdom environment `window === globalThis`, so those Node globals shadow
// jsdom's storage. Back each with an in-memory Storage-shaped stub when it's
// unavailable; where jsdom's real storage resolves (e.g. CI's Node 24) this
// is a no-op. Mirrors the fix in packages/core driverPolicy.test.ts.
const backfillStorage = (name: "localStorage" | "sessionStorage") => {
  const available = (() => {
    try {
      return typeof globalThis[name] !== "undefined" && globalThis[name] != null;
    } catch {
      return false;
    }
  })();
  if (available) return;
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      }
    }
  });
};

backfillStorage("localStorage");
backfillStorage("sessionStorage");
