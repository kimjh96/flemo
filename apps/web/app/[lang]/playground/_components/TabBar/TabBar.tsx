"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

const TABS = ["/tonight/home", "/tonight/tickets"] as const;
type TabPath = (typeof TABS)[number];

// The app's tab bar, handed to BOTH tab screens as `sharedBottomBar` under one
// id.
//
// That is what pins it. A bar declared inside each screen would travel with the
// screens and cross-fade on every tab switch; a SHARED bar is kept out of the
// transition, so the tabs stay put and only the content behind them moves.
//
// Tabs are peers, so switching one is a `replace`: the stack keeps its depth
// (the readout under the frame is where that shows) and Back still leaves the
// app rather than walking back through every tab that was visited.
//
// It is deliberately NOT wrapped in a <Part>. A tab bar is the one piece of
// chrome that should be perfectly still — it is the fixed reference the moving
// screens are read against, and a tab bar that animates on a push is the
// clearest possible sign that a shared bar was not used.
function TabBar() {
  const t = getDict(useShellLang()).playground.app;
  const navigate = useNavigate();
  const path = usePathname();

  const labels: Record<TabPath, string> = {
    "/tonight/home": t.home,
    "/tonight/tickets": t.tickets
  };

  return (
    <nav className="flex h-14 items-stretch border-t border-[var(--color-border-light)] bg-[var(--color-bg)]">
      {TABS.map((tab) => {
        const active = path.startsWith(tab);

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
