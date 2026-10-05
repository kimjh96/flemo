import type { ReactNode } from "react";

import Icon, { type IconName } from "@/components/Icon";

export type CalloutKind = "note" | "tip" | "warn";

const KIND: Record<CalloutKind, { icon: IconName; tone: string }> = {
  note: { icon: "book", tone: "text-fg-muted" },
  tip: { icon: "sparkle", tone: "text-accent" },
  warn: { icon: "close", tone: "text-warning" }
};

export interface CalloutProps {
  kind?: CalloutKind;
  title?: string;
  children: ReactNode;
}

function Callout({ kind = "note", title, children }: CalloutProps) {
  const { icon, tone } = KIND[kind];

  return (
    <div
      role="note"
      className="flex gap-3 rounded-lg border border-line bg-bg-subtle px-4 py-3.5 text-sm text-fg-muted"
    >
      <Icon name={icon} size={16} className={`mt-[3px] shrink-0 ${tone}`} />
      <div className="min-w-0 [&_code]:text-fg">
        {title && <p className="mb-0.5 font-medium text-fg">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export default Callout;
