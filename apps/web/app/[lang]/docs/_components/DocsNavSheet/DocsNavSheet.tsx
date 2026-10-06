"use client";

import Icon from "@/components/Icon";
import useExitPresence from "@/app/[lang]/_hooks/useExitPresence";

import DocsNavList from "../DocsNavList";

export interface DocsNavSheetProps {
  open: boolean;
  title: string;
  onClose: () => Promise<unknown> | void;
}

// Drops into place and closes faster than it opens, the same as the site menu;
// under reduced motion it only fades. Keyframes live in global.css.
const SHEET_MOTION = [
  "data-[state=open]:animate-[menu-panel-in_220ms_var(--ease-out)_both]",
  "data-[state=closed]:animate-[menu-panel-out_140ms_ease-in_both]",
  "motion-reduce:data-[state=open]:animate-[fade-in_220ms_var(--ease-out)_both]",
  "motion-reduce:data-[state=closed]:animate-[fade-out_140ms_ease-in_both]"
].join(" ");

// The page list on a phone. Opened through a useStep history entry, so the
// system Back gesture closes it without leaving the page.
function DocsNavSheet({ open, title, onClose }: DocsNavSheetProps) {
  // On screen through its close animation.
  const { present, onAnimationEnd } = useExitPresence(open);
  if (!present) return null;

  return (
    <div
      data-testid="docs-nav-sheet"
      data-state={open ? "open" : "closed"}
      inert={!open}
      onAnimationEnd={onAnimationEnd}
      className={`absolute inset-0 z-30 flex flex-col bg-bg md:hidden ${SHEET_MOTION}`}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="label text-fg-subtle">{title}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={() => onClose()}
          className="grid size-8 place-items-center rounded-md text-fg hover:bg-surface-2"
        >
          <Icon name="close" size={17} />
        </button>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-2 py-5">
        <DocsNavList onBeforeNavigate={onClose} />
      </div>
    </div>
  );
}

export default DocsNavSheet;
