"use client";

import { Part, Screen, useParams, useStep } from "@flemo/react";

import LabCodePanel from "../../_components/LabCodePanel";
import LabRevealProbe from "../../_components/LabRevealProbe";
import { gradientForHue, LAB_ITEMS } from "../../_data/labItems";
import { useLabSettings } from "../../_providers/LabSettingsProvider";

// A full-bleed colour panel with a big screen number. The whole playground area
// IS this screen, so the selected transition plays out at full scale when you
// move between panels. "View source" dogfoods flemo `useStep`: it pushes a
// history step (the `code` param), so the source panel opens without leaving the
// playground and Back/close pops it. The panel is always mounted and slides in
// or out on `open`, so both opening and closing animate from the same CSS.
function LabPanelScreen() {
  const params = useParams<"/playground/:n">();
  const { pushStep, popStep } = useStep<"/playground/:n">();
  const { transition } = useLabSettings();

  const n = Number(params?.n ?? "1");
  const item = LAB_ITEMS[(n - 1) % LAB_ITEMS.length]!;
  const open = Boolean(params?.code);

  const handleViewSource = () => {
    pushStep({ n: String(n), code: transition });
  };

  const handleCloseSource = () => {
    if (open) popStep();
  };

  return (
    <Screen statusBarHeight="0px" systemNavigationBarHeight="0px" backgroundColor="var(--color-bg)">
      <div
        className="relative flex h-full w-full flex-col items-center justify-center text-white"
        style={{ background: gradientForHue(item.hue) }}
      >
        <span className="text-xs font-bold tracking-[0.3em] uppercase opacity-70">Screen</span>
        <span
          data-testid="lab-panel-number"
          className="text-[clamp(5rem,16vw,12rem)] leading-none font-extrabold drop-shadow-lg"
        >
          {n}
        </span>
        <Part name="panel-title">
          <span className="mt-1 block text-2xl font-bold">{item.title}</span>
        </Part>

        {open ? null : (
          <button
            type="button"
            onClick={handleViewSource}
            className="absolute top-20 right-4 flex cursor-pointer items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3.5 py-2 text-[13px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8 8l-4 4 4 4M16 8l4 4-4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            View source
          </button>
        )}
      </div>

      <LabCodePanel slug={transition} open={open} onClose={handleCloseSource} />
      <LabRevealProbe />
    </Screen>
  );
}

export default LabPanelScreen;
