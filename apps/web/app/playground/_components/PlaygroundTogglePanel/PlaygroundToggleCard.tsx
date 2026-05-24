import type { PropsWithChildren } from "react";

function PlaygroundToggleCard({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[0_2px_16px_-8px_rgba(15,19,27,0.08)]">
      {children}
    </div>
  );
}

export default PlaygroundToggleCard;
