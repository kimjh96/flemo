"use client";

import { useNavigate } from "@flemo/react";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";

export type TabPath = "/" | "/search";

export interface TabBarProps {
  activePath: TabPath;
}

interface Tab {
  path: TabPath;
  labelKey: "library" | "search";
  icon: (active: boolean) => React.ReactNode;
}

const tabs: Tab[] = [
  {
    path: "/",
    labelKey: "library",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <path
          d="M4 5h14M4 11h14M4 17h9"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.6}
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    path: "/search",
    labelKey: "search",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle
          cx="9.5"
          cy="9.5"
          r="6"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.6}
          fill="none"
        />
        <path
          d="M14.5 14.5L18 18"
          stroke="currentColor"
          strokeWidth={active ? 2.2 : 1.6}
          strokeLinecap="round"
        />
      </svg>
    )
  }
];

function TabBar({ activePath }: TabBarProps) {
  const navigate = useNavigate();

  const handleSelect = (path: TabPath) => {
    if (path === activePath) return;
    navigate.replace(path, undefined, { transitionName: "breathe" });
  };

  return (
    <nav className="flex items-stretch bg-[var(--color-surface)] px-2 pb-2 pt-1.5">
      {tabs.map((tab) => (
        <TabBarButton
          key={tab.path}
          tab={tab}
          active={activePath === tab.path}
          onSelect={handleSelect}
        />
      ))}
    </nav>
  );
}

interface TabBarButtonProps {
  tab: Tab;
  active: boolean;
  onSelect: (path: TabPath) => void;
}

function TabBarButton({ tab, active, onSelect }: TabBarButtonProps) {
  const dict = usePlaygroundDict();
  const handleClick = () => onSelect(tab.path);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-1 flex-col items-center gap-0.5 py-1"
      style={{ color: active ? "var(--color-brand)" : "var(--color-ink-mute)" }}
    >
      {tab.icon(active)}
      <span className="text-[10px] font-semibold tracking-wide">{dict.tabBar[tab.labelKey]}</span>
    </button>
  );
}

export default TabBar;
