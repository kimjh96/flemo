"use client";

import { Part, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import StageScreen from "../../_components/StageScreen";

import { pieceById, surfaceFor } from "../../_data/gallery";

// A screen of the APP, pushed from inside the nested one.
//
// This is the isolation case, and it is a routing decision rather than a prop.
// It declares no tab bar and it is not inside the Browse Router's Slot, so the
// header and the tabs are not "hidden" for it — they are simply not at this
// level, and the whole region they belong to leaves with its own transition
// while this screen arrives with its own.
//
// The piece screen reaches this level with `router: "parent"`. Nothing else
// about the call changes: the same push, aimed one Router up.
function InfoScreen() {
  const navigate = useNavigate();
  const params = useParams<"/studio/info/:id">();
  const t = getDict(useShellLang()).playground;
  const piece = pieceById(params?.id ?? "1");

  if (!piece) return null;

  return (
    <StageScreen backgroundColor="var(--color-bg)">
      <div className="flex h-full flex-col">
        <div
          className="h-40 shrink-0"
          style={{ background: surfaceFor(piece.hue) }}
          aria-hidden="true"
        />
        <Part name="step-content" className="flex min-h-0 flex-1 flex-col gap-3 px-5 pt-5">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {piece.title}
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {t.demo.infoBody}
          </p>
          <button
            type="button"
            onClick={() => navigate.pop()}
            className="mt-2 w-fit cursor-pointer rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            {t.demo.filterClose}
          </button>
        </Part>
      </div>
    </StageScreen>
  );
}

export default InfoScreen;
