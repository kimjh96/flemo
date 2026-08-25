"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import { pieceById } from "../../_data/gallery";

// The header, as CHROME of its Router: rendered beside the <Slot>, never inside
// a screen.
//
// This is the routing answer to "the header should stay". It is not shared
// between screens, handed from one to the next, or cross-faded into place: it
// is simply not in the region that transitions. Nothing about a navigation can
// move it, because it is not part of one.
//
// The wrong version of this shipped first: a `sharedTopBar` declared by each
// screen, which made every push a hand-over between two bars and needed a
// <Part> to hide the swap. That is a lot of machinery to reproduce what a Slot
// does by standing still.
//
// The title comes from the route, so it changes when the address does, and the
// back control appears for the routes that have somewhere to go back to.
function BrowseHeader() {
  const t = getDict(useShellLang()).playground;
  const navigate = useNavigate();
  const path = usePathname();
  const pieceId = path.startsWith("/browse/piece/") ? path.split("/").pop() : undefined;
  const piece = pieceId ? pieceById(pieceId) : undefined;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-3">
      <div className="flex size-8 items-center justify-center">
        {piece ? (
          <button
            type="button"
            onClick={() => navigate.pop()}
            aria-label="Back"
            className="grid size-8 cursor-pointer place-items-center rounded-full text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--color-text-primary)]">
        {piece ? piece.title : t.gallery.title}
      </span>
    </header>
  );
}

export default BrowseHeader;
