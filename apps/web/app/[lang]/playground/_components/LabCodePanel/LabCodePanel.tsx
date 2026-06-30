import CodeBlock from "@/components/molecules/CodeBlock";
import { transitionMetaBySlug } from "../../_data/transitions";

import type { LabTransition } from "../../_providers/LabSettingsProvider";

export interface LabCodePanelProps {
  slug: LabTransition;
  // Always mounted; `open` slides it in or out via a CSS transition, so opening
  // and closing animate from the same declaration (no mount/unmount timing).
  open: boolean;
  onClose: () => void;
}

const KIND_LABEL = {
  "built-in": "Built-in",
  custom: "Custom"
} as const;

// The source viewer for the selected transition. It lives inside the panel
// Screen so its open/closed state is driven by flemo `useStep`: a backdrop tap,
// the close button, or the browser Back button all pop the step. Custom
// transitions render their authored createTransition (and createDecorator)
// source; built-ins show a short note instead. The scroll box reserves the
// control dock's measured height (--lab-dock-height, published by LabControls)
// so the last code lines clear it instead of scrolling behind the glass.
function LabCodePanel({ slug, open, onClose }: LabCodePanelProps) {
  const meta = transitionMetaBySlug(slug);
  if (!meta) return null;

  return (
    <div className={`absolute inset-0 z-10 flex flex-col ${open ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close source"
        tabIndex={open ? 0 : -1}
        className="absolute inset-0 cursor-pointer bg-[var(--color-overlay)] backdrop-blur-[2px] transition-opacity duration-300 ease-out"
        style={{ opacity: open ? 1 : 0 }}
      />
      <div
        className="relative flex h-full flex-col gap-3 px-4 pt-20 pb-[calc(var(--lab-dock-height,15rem)+2.25rem)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(18px)"
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[var(--color-bg)]/80 px-3.5 py-2.5 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <span className="text-sm font-bold text-[var(--color-text-primary)]">{meta.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              meta.kind === "built-in"
                ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                : "bg-[var(--color-primary)]/12 text-[var(--color-primary)]"
            }`}
          >
            {KIND_LABEL[meta.kind]}
          </span>
          {meta.decorator ? (
            <span className="rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
              +{meta.decorator}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            tabIndex={open ? 0 : -1}
            className="ml-auto grid size-8 cursor-pointer place-items-center rounded-full bg-[var(--color-layer)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {meta.source ? (
            <CodeBlock code={meta.source} lang="ts" className="h-full" />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[var(--color-layer)]/70 px-4 py-6 backdrop-blur-md">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Built into @flemo/react
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {meta.label} ships with the library, so there is no authored source in this
                playground. Pick a custom transition to read its createTransition definition.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LabCodePanel;
