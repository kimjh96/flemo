"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

const TAB_ORDER = ["/wallet/home", "/wallet/activity"] as const;
type TabPath = (typeof TAB_ORDER)[number];

const ICONS: Record<TabPath, string> = {
  "/wallet/home": "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  "/wallet/activity": "M5 7h14M5 12h14M5 17h14"
};

// The persistent tab bar. It lives outside the <Slot>, so it stays put while the
// screens transition. Home and Activity are peers, so a tap is a lateral
// shared-axis move (direction from nav order); a tap from the pushed detail
// collapses back to that tab.
function WalletTabBar() {
  const dict = useShellDict();
  const navigate = useNavigate();
  const path = usePathname();

  const onTab = (TAB_ORDER as readonly string[]).includes(path);
  const isActive = (tab: TabPath) => tab === path || (tab === "/wallet/home" && !onTab);

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
    { path: "/wallet/home", label: dict.wallet.tab.home },
    { path: "/wallet/activity", label: dict.wallet.tab.activity }
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

export default WalletTabBar;
