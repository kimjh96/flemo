"use client";

import { Part, useNavigate, useParams } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import Shared from "../../_components/Shared";
import StageScreen from "../../_components/StageScreen";

import { pieceById, surfaceFor } from "../../_data/gallery";

// The SECOND morph hop, and the one that changes what a morph is doing.
//
// The list to the piece is a card growing into a page. The piece to here is the
// artwork alone becoming the whole frame: same `layoutId`, third size, and this
// time the screen takes no bar at all, so nothing is left around the element to
// explain it. It runs under `zoom`, so the screen it leaves is carried with the
// element rather than staying behind it.
//
// Two hops in one stack is the case a single pair cannot show: the artwork is
// the SMALL side of one flight and the BIG side of the next, and popping unwinds
// both without either one leaving something for the other to trip on.
function ViewerScreen() {
  const navigate = useNavigate();
  const params = useParams<"/browse/viewer/:id">();
  const t = getDict(useShellLang()).playground;
  const piece = pieceById(params?.id ?? "1");

  if (!piece) return null;

  return (
    <StageScreen backgroundColor="transparent">
      <button
        type="button"
        onClick={() => navigate.pop()}
        className="relative block h-full w-full cursor-zoom-out"
        aria-label={t.demo.close}
      >
        <Shared
          layoutId={`art-${piece.id}`}
          className="block h-full w-full"
          style={{ background: surfaceFor(piece.hue) }}
          aria-hidden="true"
        />
        <Part
          name="detail-content"
          className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/55 to-transparent px-5 pt-10 pb-6 text-left"
        >
          <span className="text-lg font-extrabold tracking-[-0.02em] text-white">
            {piece.title}
          </span>
          <span className="font-mono text-[11px] text-white/70">{piece.place}</span>
        </Part>
      </button>
    </StageScreen>
  );
}

export default ViewerScreen;
