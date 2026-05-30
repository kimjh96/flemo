import type { PropsWithChildren } from "react";

function PlaygroundToggleCard({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      {children}
    </div>
  );
}

export default PlaygroundToggleCard;
