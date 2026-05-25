import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useHistoryStore } from "@flemo/core";

import Renderer from "@renderer/Renderer";

import Route from "@Route";

const reset = () => useHistoryStore.setState({ index: -1, histories: [] });

const seed = (entries: Array<{ id: string; pathname: string; params?: object }>) => {
  useHistoryStore.setState({
    index: entries.length - 1,
    histories: entries.map((e) => ({
      id: e.id,
      pathname: e.pathname,
      params: e.params ?? {},
      transitionName: "cupertino",
      layoutId: null
    }))
  });
};

afterEach(reset);

describe("Renderer", () => {
  it("renders nothing when history is empty", () => {
    const { container } = render(
      <Renderer>
        <Route path="/" element={<div data-testid="root">root</div>} />
      </Renderer>
    );
    expect(container.querySelector('[data-testid="root"]')).toBeNull();
  });

  it("matches a single history entry to the route element by path-to-regexp", () => {
    seed([{ id: "a", pathname: "/" }]);
    const { getByTestId } = render(
      <Renderer>
        <Route path="/" element={<div data-testid="home">home</div>} />
        <Route path="/posts/:id" element={<div data-testid="post">post</div>} />
      </Renderer>
    );
    expect(getByTestId("home")).toBeDefined();
  });

  it("stacks screens in history order, each mounted from its matched Route", () => {
    seed([
      { id: "a", pathname: "/" },
      { id: "b", pathname: "/posts/42" }
    ]);
    const { getByTestId } = render(
      <Renderer>
        <Route path="/" element={<div data-testid="home">home</div>} />
        <Route path="/posts/:id" element={<div data-testid="post">post</div>} />
      </Renderer>
    );
    expect(getByTestId("home")).toBeDefined();
    expect(getByTestId("post")).toBeDefined();
  });

  it("falls through Routes in order — the first matching Route wins", () => {
    seed([{ id: "a", pathname: "/users/me" }]);
    const { getByTestId, queryByTestId } = render(
      <Renderer>
        <Route path="/users/:id" element={<div data-testid="dynamic">dynamic</div>} />
        <Route path="/users/me" element={<div data-testid="static">static</div>} />
      </Renderer>
    );
    expect(getByTestId("dynamic")).toBeDefined();
    expect(queryByTestId("static")).toBeNull();
  });

  it("preserves screen identity across re-renders via history id (no flicker)", () => {
    seed([{ id: "stable-id", pathname: "/" }]);
    const { getByTestId, rerender } = render(
      <Renderer>
        <Route path="/" element={<div data-testid="home">home</div>} />
      </Renderer>
    );
    const first = getByTestId("home");
    rerender(
      <Renderer>
        <Route path="/" element={<div data-testid="home">home</div>} />
      </Renderer>
    );
    expect(getByTestId("home")).toBe(first);
  });
});
