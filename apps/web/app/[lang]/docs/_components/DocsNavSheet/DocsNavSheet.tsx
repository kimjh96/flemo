"use client";

import DocsNav from "../DocsNav";

export interface DocsNavSheetProps {
  // Always mounted; `open` slides the drawer in or out so opening and closing
  // animate from the same declaration. Driven by flemo `useStep`, so the browser
  // Back button dismisses it too.
  open: boolean;
  onClose: () => void;
}

// The docs navigation as a left drawer on mobile, where the persistent sidebar
// is hidden. Selecting a page navigates and closes; the backdrop, the close
// button, and the Back button all pop the step.
function DocsNavSheet({ open, onClose }: DocsNavSheetProps) {
  return (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-[var(--color-overlay)] backdrop-blur-[2px] transition-opacity duration-300 ease-out"
        style={{ opacity: open ? 1 : 0 }}
      />
      <div
        className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-[var(--color-bg)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          // Fade the shadow out when closed; the off-screen drawer's blur would
          // otherwise leak past its right edge onto the page.
          boxShadow: `0 0 60px -10px rgba(0, 0, 0, ${open ? 0.5 : 0})`
        }}
      >
        <div className="flex items-center justify-end px-3 pt-20 pb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            tabIndex={open ? 0 : -1}
            className="grid size-9 cursor-pointer place-items-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-10">
          <DocsNav onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

export default DocsNavSheet;
