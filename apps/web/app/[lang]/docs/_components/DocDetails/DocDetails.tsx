import type { ReactNode } from "react";

import Icon from "@/components/Icon";

export interface DocDetailsProps {
  title: string;
  label: string;
  children: ReactNode;
}

// Deep material, folded away: exact rules, edge cases, the reasoning. A skim
// passes it by; a reader who needs it opens it. Native <details>, so it works
// without script and find-in-page opens it.
function DocDetails({ title, label, children }: DocDetailsProps) {
  return (
    <details className="group my-6 rounded-lg border border-line bg-bg-subtle open:bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
        <Icon
          name="chevronRight"
          size={14}
          className="shrink-0 text-fg-subtle transition-transform duration-150 group-open:rotate-90"
        />
        <span className="flex-1 text-sm font-medium text-fg">{title}</span>
        <span className="label text-fg-subtle">{label}</span>
      </summary>
      <div className="border-t border-line px-5 pt-1 pb-4">{children}</div>
    </details>
  );
}

export default DocDetails;
