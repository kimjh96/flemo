"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

const TAB_ORDER = ["/tonight", "/tonight/tickets"] as const;
type TabPath = (typeof TAB_ORDER)[number];

const ICONS: Record<TabPath, string> = {
  "/tonight": "M5 7h14M5 12h14M5 17h9",
  "/tonight/tickets":
    "M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 6 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-6Z"
};

// The tab bar, handed to BOTH tab screens as `sharedBottomBar`.
//
// Which behaviour that produces is not this component's decision. `computeBarRiding`:
//
//   "A bar rides when the partner screen does NOT own the same bar (there is no
//    seamless hand-over); it stays put when the partner owns it."
//
// So across the two tabs it HOLDS (both declare it), and on a push into the
// detail — which declares none — it RIDES out with the list and comes back on
// the pop. Both are on show here, and neither is opted into.
//
// Tabs are peers, so switching is a `replace` on the site's own shared-axis
// transitions: "a short offset + fade, never a full-width push, so the move
// reads as lateral, not as drilling deeper."
function TabBar() {
  const navigate = useNavigate();
  const path = usePathname();
  const t = getDict(useShellLang()).playground.app;

  const onTab = (TAB_ORDER as readonly string[]).includes(path);
  const isActive = (tab: TabPath) => tab === path || (tab === "/tonight" && !onTab);

  const handleTab = (target: TabPath) => {
    if (target === path) return;
    const forward = TAB_ORDER.indexOf(target) > (onTab ? TAB_ORDER.indexOf(path as TabPath) : -1);
    navigate.replace(
      target,
      {},
      { transitionName: forward ? "shared-axis-forward" : "shared-axis-backward" }
    );
  };

  const tabs: { path: TabPath; label: string }[] = [
    { path: "/tonight", label: t.tabTonight },
    { path: "/tonight/tickets", label: t.tabTickets }
  ];

  return (
    <nav className="flex shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-md">
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => handleTab(tab.path)}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
              active ? "text-[var(--color-primary)]" : "text-[var(--color-text-disabled)]"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d={ICONS[tab.path]}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export default TabBar;
