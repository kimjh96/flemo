import { beforeEach, describe, expect, it } from "vitest";

import useHistoryStore, { type History } from "@history/store";

const makeEntry = (overrides: Partial<History> = {}): History => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  pathname: overrides.pathname ?? "/",
  params: overrides.params ?? {},
  transitionName: overrides.transitionName ?? "cupertino",
  layoutId: overrides.layoutId ?? null
});

const reset = () => useHistoryStore.setState({ index: -1, histories: [] });

describe("useHistoryStore — addHistory", () => {
  beforeEach(reset);

  it("starts at index -1 with an empty stack", () => {
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(-1);
    expect(histories).toEqual([]);
  });

  it("addHistory appends and bumps index from -1 → 0", () => {
    useHistoryStore.getState().addHistory(makeEntry({ pathname: "/a" }));
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.length).toBe(1);
    expect(histories[0]!.pathname).toBe("/a");
  });

  it("multiple addHistory calls keep arrival order and walk the index", () => {
    const { addHistory } = useHistoryStore.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    addHistory(makeEntry({ pathname: "/c" }));
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(2);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b", "/c"]);
  });
});

describe("useHistoryStore — replaceHistory", () => {
  beforeEach(reset);

  it("removes the entry at the given index and decrements the index", () => {
    const { addHistory, replaceHistory } = useHistoryStore.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    addHistory(makeEntry({ pathname: "/c" }));
    // state: index=2, [a, b, c]

    replaceHistory(2);
    // state: index=1, [a, b]
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
  });

  it("composes with addHistory to model 'replace current' (add new, drop old)", () => {
    const { addHistory, replaceHistory } = useHistoryStore.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    // state: index=1, [a, b]

    // useNavigate.replace flow: addHistory(new) bumps to index=2, then
    // replaceHistory(1) drops the OLD entry at the previous index. Net is
    // "the entry at the current slot got replaced".
    const previousIndex = useHistoryStore.getState().index;
    addHistory(makeEntry({ pathname: "/c" }));
    replaceHistory(previousIndex);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/c"]);
  });
});

describe("useHistoryStore — popHistory", () => {
  beforeEach(reset);

  it("removes the entry at the given index and decrements the index", () => {
    const { addHistory, popHistory } = useHistoryStore.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));
    addHistory(makeEntry({ pathname: "/c" }));

    popHistory(2);
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
  });

  it("repeated popHistory unwinds the stack back to empty", () => {
    const { addHistory, popHistory } = useHistoryStore.getState();
    addHistory(makeEntry({ pathname: "/a" }));
    addHistory(makeEntry({ pathname: "/b" }));

    popHistory(1);
    popHistory(0);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(-1);
    expect(histories).toEqual([]);
  });
});

describe("useHistoryStore — mixed sequences", () => {
  beforeEach(reset);

  it("push → push → replace → pop ends with the expected stack and index", () => {
    const { addHistory, popHistory, replaceHistory } = useHistoryStore.getState();

    // push /a
    addHistory(makeEntry({ pathname: "/a" }));
    expect(useHistoryStore.getState().index).toBe(0);

    // push /b
    addHistory(makeEntry({ pathname: "/b" }));
    expect(useHistoryStore.getState().index).toBe(1);

    // replace /b → /c (the canonical useNavigate.replace flow: add new, drop old)
    const prevIndex = useHistoryStore.getState().index;
    addHistory(makeEntry({ pathname: "/c" }));
    replaceHistory(prevIndex);
    {
      const { index, histories } = useHistoryStore.getState();
      expect(index).toBe(1);
      expect(histories.map((h) => h.pathname)).toEqual(["/a", "/c"]);
    }

    // pop /c
    const popIndex = useHistoryStore.getState().index;
    popHistory(popIndex);
    {
      const { index, histories } = useHistoryStore.getState();
      expect(index).toBe(0);
      expect(histories.map((h) => h.pathname)).toEqual(["/a"]);
    }
  });

  it("preserves ordering across 200 sequential addHistory calls", () => {
    const { addHistory } = useHistoryStore.getState();
    for (let i = 0; i < 200; i++) {
      addHistory(makeEntry({ pathname: `/p${i}` }));
    }
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(199);
    expect(histories.length).toBe(200);
    expect(histories[0]!.pathname).toBe("/p0");
    expect(histories[199]!.pathname).toBe("/p199");
  });
});
