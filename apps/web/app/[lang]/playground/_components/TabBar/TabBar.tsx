"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

const TABS = ["/studio/browse", "/studio/saved"] as const;
type TabPath = (typeof TABS)[number];

// The app's tab bar, handed to BOTH outer screens as `sharedBottomBar` under
// one id.
//
// That is what pins it. A bar declared inside each screen would travel with
// the screens and cross-fade on every tab switch; a SHARED bar is kept out of
// the transition, so the tabs stay put and only the content behind them moves.
//
// Tabs are peers, so switching one is a `replace`: the stack keeps its depth
// (the readout under the frame is where that shows) and Back still leaves the
// app rather than walking through every tab that was visited.
function TabBar() {
  const t = getDict(useShellLang()).playground.app;
  const navigate = useNavigate();
  const path = usePathname();

  const labels: Record<TabPath, string> = {
    "/studio/browse": t.browse,
    "/studio/saved": t.saved
  };

  return (
    <nav className="flex h-14 items-stretch border-t border-[var(--color-border-light)] bg-[var(--color-bg)]">
      {TABS.map((tab) => {
        const active =
          path === tab || (tab === "/studio/browse" && !TABS.includes(path as TabPath));
        return (
          <button
            key={tab}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (active) return;
              navigate.replace(tab, {}, { transitionName: "fade" });
            }}
            className={`flex-1 cursor-pointer text-[13px] font-semibold transition-colors ${
              active
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {labels[tab]}
          </button>
        );
      })}
    </nav>
  );
}

export default TabBar;
