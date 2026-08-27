"use client";

import { useState } from "react";

import { Layer, Screen, useNavigate } from "@flemo/react";

// The sheet a consumer writes: `position: fixed`, pinned to the viewport floor,
// with a z-index that beats the shared bar's. Whether that is enough is exactly
// what this fixture is here to show, so it renders the SAME markup twice — once
// authored inside the screen, once through <Layer> — and nothing else differs.
function Sheet({ hosted, onClose }: { hosted: boolean; onClose: () => void }) {
  const body = (
    <div
      data-layer-sheet={hosted ? "hosted" : "inline"}
      className="fixed inset-x-0 bottom-0 z-50 flex h-[200px] flex-col justify-between rounded-t-[24px] border border-b-0 border-[var(--color-border-light)] bg-[var(--color-bg)] p-5 shadow-[0_-12px_36px_-24px_rgba(15,23,42,0.5)]"
    >
      <div>
        <p className="text-sm font-bold text-[var(--color-text-primary)]">
          {hosted ? "Through <Layer>" : "Written in the screen"}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          A sheet has to cover the tab bar. Push, swipe back, and watch which one still does.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="self-start rounded-full bg-[var(--color-text-primary)] px-4 py-2 text-xs font-bold text-[var(--color-bg)]"
      >
        Close
      </button>
    </div>
  );

  return hosted ? <Layer>{body}</Layer> : body;
}

function TabBar() {
  return (
    <nav
      data-layer-bar=""
      aria-label="Layer fixture tabs"
      className="relative z-10 w-full border-t border-[var(--color-border-light)] bg-[var(--color-bg)]/95 px-3 py-3 backdrop-blur-xl"
    >
      <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-[var(--color-text-secondary)]">
        <span>Home</span>
        <span>More</span>
      </div>
    </nav>
  );
}

// The shape the layering bug needs: a shared bottom bar declared by the screen
// that OWNS the region, a nested transition inside it, and a consumer overlay
// authored in the nested screen. The bar sits outside the moving screen, the
// sheet inside it, and no z-index inside a moving screen can be interleaved
// with an element outside it.
function LayerScreen() {
  const { push, pop } = useNavigate({ router: "layer" });
  const [hosted, setHosted] = useState(true);
  const [open, setOpen] = useState(false);

  return (
    <Screen
      sharedBottomBar={<TabBar />}
      sharedBottomBarId="layer-tabs"
      // Without a height the bar wrapper has no `bottom` to resolve against and
      // falls back to its static position — the TOP of the screen. A real app
      // passes the device's inset; the fixture has none, so it says zero.
      systemNavigationBarHeight="0px"
      hideStatusBar
    >
      <div className="flex h-full flex-col gap-3 p-5">
        <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">Layering</h3>

        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            data-layer-toggle=""
            checked={hosted}
            onChange={(event) => setHosted(event.target.checked)}
          />
          Wrap the sheet in &lt;Layer&gt;
        </label>

        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            data-layer-open=""
            onClick={() => setOpen(true)}
            className="rounded-xl bg-[var(--color-text-primary)] px-4 py-3 text-sm font-bold text-[var(--color-bg)]"
          >
            Open the sheet
          </button>
          <button
            type="button"
            data-layer-push=""
            onClick={() => push("/playground/layer/detail")}
            className="rounded-xl border border-[var(--color-border-light)] px-4 py-3 text-sm font-bold text-[var(--color-text-primary)]"
          >
            Push a screen
          </button>
          <button
            type="button"
            data-layer-pop=""
            onClick={() => pop()}
            className="rounded-xl border border-[var(--color-border-light)] px-4 py-3 text-sm font-bold text-[var(--color-text-secondary)]"
          >
            Pop
          </button>
        </div>
      </div>

      {open ? <Sheet hosted={hosted} onClose={() => setOpen(false)} /> : null}
    </Screen>
  );
}

export default LayerScreen;
