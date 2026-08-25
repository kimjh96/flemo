"use client";

import { usePathname, useHistoryStore, useNavigateStore } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

// The Router's own state, read with the public hooks and rendered OUTSIDE the
// <Slot>.
//
// Two things at once, both of them things the fixture should be showing rather
// than describing. It is chrome that lives beside the stack instead of inside
// it, so it survives every navigation without being part of one. And it is
// `usePathname` / `useHistoryStore` / `useNavigateStore` doing what a consumer
// would use them for: the address, the status of the flight that is running,
// and how deep the stack is, live, while you drive it.
function StackReadout() {
  const t = getDict(useShellLang()).playground.demo;
  const pathname = usePathname();
  const status = useNavigateStore((state) => state.status);
  const depth = useHistoryStore((state) => state.histories.length);
  const index = useHistoryStore((state) => state.index);

  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-0.5 border-t border-[var(--color-border-light)] bg-[var(--color-layer)] px-4 py-2 font-mono text-[11px]">
      <dt className="text-[var(--color-text-disabled)]">{t.path}</dt>
      <dd className="m-0 truncate text-[var(--color-text-primary)]">{pathname}</dd>
      <dt className="text-[var(--color-text-disabled)]">{t.status}</dt>
      <dd
        className={`m-0 ${status === "COMPLETED" || status === "IDLE" ? "text-[var(--color-text-secondary)]" : "text-[var(--color-primary)]"}`}
      >
        {status}
      </dd>
      <dt className="text-[var(--color-text-disabled)]">{t.depth}</dt>
      <dd className="m-0 text-[var(--color-text-secondary)]">
        {index + 1} / {depth}
      </dd>
    </dl>
  );
}

export default StackReadout;
