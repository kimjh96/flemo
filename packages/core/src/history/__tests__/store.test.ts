import { beforeEach, describe, expect, it } from "vitest";

import createHistoryStore, { type History, type HistoryStoreApi } from "@history/store";

const makeEntry = (overrides: Partial<History> = {}): History => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  pathname: overrides.pathname ?? "/",
  params: overrides.params ?? {},
  transitionName: overrides.transitionName ?? "cupertino",
  layoutId: overrides.layoutId ?? null
});

let store: HistoryStoreApi;

// Fresh, isolated store per test (the factory defaults to index -1, empty stack).
const reset = () => {
  store = createHistoryStore();
};

describe("createHistoryStore — addHistory", () => {
  beforeEach(reset);

  it("starts at index -1 with an empty stack", () => {
    const { index, histories } = store.getState();
    expect(index).toBe(-1);
    expect(histories).toEqual([]);
  });

  it("addHistory appends and bumps index from -1 → 0", () => {
    store.getState().addHistory(makeEntry({ pathname: "/a" }));
    const { index, histories } = store.getState();
    expect(index).toBe(0);
    expect(histories.length).toBe(1);
    expect(histories[0]!.pathname).toBe("/a");
  });

  it("multiple addHistory calls keep arrival order and walk the index", () => {
    const { addHistory } = store.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    addHistory(makeEntry({ pathname: "/c" }));
    const { index, histories } = store.getState();
    expect(index).toBe(2);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b", "/c"]);
  });
});

describe("createHistoryStore — replaceHistory", () => {
  beforeEach(reset);

  it("removes the entry at the given index and decrements the index", () => {
    const { addHistory, replaceHistory } = store.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    addHistory(makeEntry({ pathname: "/c" }));
    // state: index=2, [a, b, c]

    replaceHistory(2);
    // state: index=1, [a, b]
    const { index, histories } = store.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
  });

  it("composes with addHistory to model 'replace current' (add new, drop old)", () => {
    const { addHistory, replaceHistory } = store.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    // state: index=1, [a, b]

    // useNavigate.replace flow: addHistory(new) bumps to index=2, then
    // replaceHistory(1) drops the OLD entry at the previous index. Net is
    // "the entry at the current slot got replaced".
    const previousIndex = store.getState().index;
    addHistory(makeEntry({ pathname: "/c" }));
    replaceHistory(previousIndex);

    const { index, histories } = store.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/c"]);
  });
});

describe("createHistoryStore — popHistory", () => {
  beforeEach(reset);

  it("removes the entry at the given index and decrements the index", () => {
    const { addHistory, popHistory } = store.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    addHistory(makeEntry({ pathname: "/c" }));

    popHistory(2);
    const { index, histories } = store.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
  });

  it("repeated popHistory unwinds the stack back to empty", () => {
    const { addHistory, popHistory } = store.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));

    popHistory(1);
    popHistory(0);

    const { index, histories } = store.getState();
    expect(index).toBe(-1);
    expect(histories).toEqual([]);
  });
});

describe("createHistoryStore — popHistories", () => {
  beforeEach(reset);

  const seed = (...pathnames: string[]) => {
    const { addHistory } = store.getState();
    for (const pathname of pathnames) addHistory(makeEntry({ pathname }));
  };

  it("drops `count` entries directly below the top, keeping the top", () => {
    seed("/a", "/b", "/c", "/d"); // index=3, [a,b,c,d]

    store.getState().popHistories(1);
    // The screen directly below the top (c) is removed; d stays as the top.
    const { index, histories } = store.getState();
    expect(index).toBe(2);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b", "/d"]);
  });

  it("drops multiple intermediates at once and keeps both the root and the top", () => {
    seed("/a", "/b", "/c", "/d"); // index=3

    store.getState().popHistories(2);
    // b and c are removed; a (root) and d (top) survive.
    const { index, histories } = store.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/d"]);
  });

  it("is a no-op for count <= 0", () => {
    seed("/a", "/b", "/c"); // index=2

    store.getState().popHistories(0);
    store.getState().popHistories(-3);

    const { index, histories } = store.getState();
    expect(index).toBe(2);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b", "/c"]);
  });
});

describe("createHistoryStore — setTransitionName", () => {
  beforeEach(reset);

  const seed = (...pathnames: string[]) => {
    const { addHistory } = store.getState();
    for (const pathname of pathnames) addHistory(makeEntry({ pathname, transitionName: "none" }));
  };

  it("overrides one entry's transition and leaves the rest untouched", () => {
    seed("/a", "/b", "/c"); // all "none"

    store.getState().setTransitionName(2, "cupertino");

    const { histories } = store.getState();
    expect(histories.map((h) => h.transitionName)).toEqual(["none", "none", "cupertino"]);
  });

  it("returns a fresh array and entry so subscribers re-read (immutable)", () => {
    seed("/a", "/b");
    const before = store.getState().histories;
    const beforeEntry = before[0]!;

    store.getState().setTransitionName(0, "material");

    const after = store.getState().histories;
    expect(after).not.toBe(before);
    expect(after[0]).not.toBe(beforeEntry);
    // The other entry is preserved by reference.
    expect(after[1]).toBe(before[1]);
  });

  it("is a no-op for a missing index or an unchanged value", () => {
    seed("/a");
    const before = store.getState().histories;

    store.getState().setTransitionName(5, "cupertino"); // out of range
    store.getState().setTransitionName(0, "none"); // same value

    expect(store.getState().histories).toBe(before);
  });
});

describe("createHistoryStore — mixed sequences", () => {
  beforeEach(reset);

  it("push → push → replace → pop ends with the expected stack and index", () => {
    const { addHistory, popHistory, replaceHistory } = store.getState();

    // push /a
    addHistory(makeEntry({ pathname: "/a" }));
    expect(store.getState().index).toBe(0);

    // push /b
    addHistory(makeEntry({ pathname: "/b" }));
    expect(store.getState().index).toBe(1);

    // replace /b → /c (the canonical useNavigate.replace flow: add new, drop old)
    const prevIndex = store.getState().index;
    addHistory(makeEntry({ pathname: "/c" }));
    replaceHistory(prevIndex);
    {
      const { index, histories } = store.getState();
      expect(index).toBe(1);
      expect(histories.map((h) => h.pathname)).toEqual(["/a", "/c"]);
    }

    // pop /c
    const popIndex = store.getState().index;
    popHistory(popIndex);
    {
      const { index, histories } = store.getState();
      expect(index).toBe(0);
      expect(histories.map((h) => h.pathname)).toEqual(["/a"]);
    }
  });

  it("preserves ordering across 200 sequential addHistory calls", () => {
    const { addHistory } = store.getState();
    for (let i = 0; i < 200; i++) {
      addHistory(makeEntry({ pathname: `/p${i}` }));
    }
    const { index, histories } = store.getState();
    expect(index).toBe(199);
    expect(histories.length).toBe(200);
    expect(histories[0]!.pathname).toBe("/p0");
    expect(histories[199]!.pathname).toBe("/p199");
  });
});
