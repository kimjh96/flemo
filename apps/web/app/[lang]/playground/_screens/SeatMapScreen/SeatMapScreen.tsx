"use client";

import { Part, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import AppBar from "../../_components/AppBar";
import BackButton from "../../_components/BackButton";
import StageScreen from "../../_components/StageScreen";

import { useFlightParts } from "../../_hooks/useFlightParts";

import { actById } from "../../_data/tonight";

// A screen at the APP's level rather than the tab's.
//
// This is the one arrangement that is easy to fake and worth doing properly. A
// seat map takes over the whole app: no tab bar, no listings header. The wrong
// way to build it is a screen inside the tab that hides both; the right way is
// a screen at a level where neither exists, pushed with `router: "parent"`.
//
// The difference is visible rather than academic. Hiding them would animate the
// bars away on this screen's clock; pushing a level up carries the ENTIRE tab
// region out with its own transition, bars included, as one thing. The readout
// under the frame shows the same fact from the other side: the outer stack
// deepens and the inner one does not move.
function SeatMapScreen() {
  const navigate = useNavigate();
  const params = useParams<"/tonight/seatmap/:id">();
  const act = actById(params?.id);
  const { barPart, bodyPart } = useFlightParts();
  const t = getDict(useShellLang()).playground;

  if (!act) return null;

  return (
    <StageScreen
      backgroundColor="var(--color-bg)"
      sharedTopBarId="seatmap"
      sharedTopBar={
        <AppBar
          part={barPart}
          title={t.act.seatmap}
          lead={<BackButton onClick={() => navigate.pop()} />}
        />
      }
    >
      <div className="h-full overflow-y-auto px-4 pt-4 pb-8">
        <Part name={bodyPart}>
          <span className="block rounded-2xl bg-[var(--color-layer)] p-4">
            <span className="mx-auto block h-1.5 w-2/3 rounded-full bg-[var(--color-text-disabled)]" />
            <span className="mt-1.5 block text-center text-[10px] font-bold tracking-[0.14em] text-[var(--color-text-disabled)] uppercase">
              {t.app.stage}
            </span>
            <span className="mt-4 grid grid-cols-8 gap-1.5">
              {Array.from({ length: 40 }, (_, seat) => (
                <span
                  key={seat}
                  className={`block aspect-square rounded-[4px] ${
                    seat % 7 === 3
                      ? "bg-[var(--color-border)]"
                      : "bg-[var(--color-primary)] opacity-70"
                  }`}
                />
              ))}
            </span>
          </span>
        </Part>

        <Part name={bodyPart} className="mt-4">
          <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {t.act.seatmapBody}
          </p>
        </Part>
      </div>
    </StageScreen>
  );
}

export default SeatMapScreen;
