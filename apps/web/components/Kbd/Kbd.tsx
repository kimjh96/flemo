import type { ReactNode } from "react";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-surface-2 px-1 font-mono text-micro text-fg-subtle">
      {children}
    </kbd>
  );
}

export default Kbd;
