import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Screen from "@screen/Screen";

import Route from "@Route";

import Router from "../Router";
import Slot from "../Slot";

// THE FIRST CLIENT RENDER HAS TO BE THE SERVER'S RENDER.
//
// A Router adopts the identity of the browser entry it mounted on, so that a
// traversal back onto that entry matches by id instead of colliding with the
// generic "root". That adoption reads `window.history.state`, which the server
// cannot see — and it ran during the FIRST render, which for a hydrating tree
// is the one render that must agree with the server.
//
// `history.state` survives a reload, so any reload on a page that had pushed
// left the client seeding a generated id where the server had written "root":
//
//   + data-flemo-screen="1788648834008-1788648872620-ccjmp40m9"   (client)
//   - data-flemo-screen="root"                                     (server)
//
// React does not patch mismatched attributes, so the DOM kept "root" while the
// store believed the generated id — the engine and the document disagreeing
// about which screen this is, for the life of the page. Reported from the
// browser as a console error on refreshing the home page.

const app = (
  <Router initPath="/">
    <Slot>
      <Route path="/" element={<Screen>home</Screen>} />
      <Route path="/next" element={<Screen>next</Screen>} />
    </Slot>
  </Router>
);

/** What a previous page instance leaves behind when the user reloads. */
const seedRestoredEntry = () => {
  window.history.replaceState(
    { id: "1788648834008-1788648872620-ccjmp40m9", index: 2, status: "IDLE", params: {} },
    "",
    "/"
  );
};

let errors: string[] = [];
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errors = [];
  consoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map((value) => String(value)).join(" "));
  });
});

afterEach(() => {
  consoleError.mockRestore();
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "";
});

describe("hydrating a Router onto server HTML", () => {
  it("keeps the screen id the server wrote when the entry carries another", async () => {
    // The server has no history.state, so it always writes the seeded root.
    const html = renderToString(app);
    expect(html).toContain('data-flemo-screen="root"');

    seedRestoredEntry();

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, app);
    });

    const hydrationErrors = errors.filter((entry) =>
      /hydrat|didn't match|server rendered HTML/i.test(entry)
    );
    expect(hydrationErrors).toEqual([]);
    expect(container.querySelector("[data-flemo-screen]")?.getAttribute("data-flemo-screen")).toBe(
      "root"
    );
  });

  // The adoption itself is pinned in core, where the entry frame can be keyed
  // deterministically: packages/core/src/core/__tests__/adoptEntryIdentity.test.ts.
  // What only React can show is this: the render that hydrates must not diverge
  // from the HTML it is hydrating.
});
