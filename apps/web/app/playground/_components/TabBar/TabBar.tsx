import { useNavigate, useScreen } from "@flemo/react";

import { INITIAL_CART } from "../data";
import Icon from "../Icon";
import { useLang } from "../lang";

const TABS = [
  { key: "shop", path: "/", icon: "shop" as const },
  { key: "cart", path: "/cart", icon: "cart" as const },
  { key: "account", path: "/account", icon: "user" as const }
];

const cartCount = INITIAL_CART.reduce((n, item) => n + item.quantity, 0);

export default function TabBar() {
  const navigate = useNavigate();
  const screen = useScreen();
  const t = useLang();
  const activeKey = activeTabFor(screen.routePath);
  const activeIndex = TABS.findIndex((tab) => tab.key === activeKey);
  const labels = { shop: t.tabs.shop, cart: t.tabs.cart, account: t.tabs.account } as const;

  return (
    <nav className="flex h-[64px] items-stretch border-t border-[var(--color-line)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab, i) => {
        const active = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              if (active) return;
              const direction = i > activeIndex ? "fadeRight" : "fadeLeft";
              navigate.replace(tab.path as "/" | "/cart" | "/account", undefined, {
                transitionName: direction
              });
            }}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              active
                ? "text-[var(--color-brand)]"
                : "text-[var(--color-ink-mute)] active:text-[var(--color-ink-soft)]"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="relative">
              <Icon name={tab.icon} size={22} />
              {tab.key === "cart" && cartCount > 0 && (
                <span className="absolute -right-2 -top-1 grid size-4 place-items-center rounded-full bg-[var(--color-brand)] text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold tracking-wide">
              {labels[tab.key as keyof typeof labels]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function activeTabFor(routePath: unknown): string {
  const path = Array.isArray(routePath) ? routePath[0] : routePath;
  if (typeof path !== "string") return "shop";
  if (path.startsWith("/cart") || path.startsWith("/checkout")) return "cart";
  if (path.startsWith("/account")) return "account";
  return "shop";
}
