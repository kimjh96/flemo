"use client";

import Icon from "@/components/Icon";

import DocsNavList from "../DocsNavList";

export interface DocsNavSheetProps {
  open: boolean;
  title: string;
  onClose: () => Promise<unknown> | void;
}

// The page list on a phone. Opened through a useStep history entry, so the
// system Back gesture closes it without leaving the page.
function DocsNavSheet({ open, title, onClose }: DocsNavSheetProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg md:hidden">
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
