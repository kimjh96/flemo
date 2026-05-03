import { Screen, useNavigate } from "flemo";

import AppBar from "../../AppBar";
import { findProduct, formatKRW, INITIAL_CART, pick } from "../../data";
import { format } from "../../dict";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";

export default function QuickBuy() {
  const navigate = useNavigate();
  const t = useLang();
  const lang = useLangCode();
  const lines = INITIAL_CART.map((item) => ({ item, product: findProduct(item.productId) }));
  const total = lines.reduce((n, l) => n + l.product.price * l.item.quantity, 0);

  return (
    <Screen
      backgroundColor="var(--color-surface)"
      appBar={
        <AppBar
          title={t.appBar.quickBuy}
          bordered
          trailing={
            <button
              type="button"
              onClick={() => navigate.pop()}
              className="flex size-10 items-center justify-center rounded-full text-[var(--color-ink)] active:opacity-60"
              aria-label="Close"
            >
              <Icon name="close" size={20} />
            </button>
          }
        />
      }
    >
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="rounded-2xl border border-[var(--color-line)] p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]">
            {t.quickBuy.summary}
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {lines.slice(0, 2).map((l) => (
              <li
                key={`${l.item.productId}-${l.item.size}`}
                className="flex items-center justify-between text-[13px]"
              >
                <span className="text-[var(--color-ink)]">
                  {pick(l.product.name, lang)} · {l.item.size}
                </span>
                <span className="text-[var(--color-ink-soft)]">×{l.item.quantity}</span>
              </li>
            ))}
            {lines.length > 2 && (
              <li className="text-[12.5px] text-[var(--color-ink-mute)]">
                {format(t.quickBuy.otherCount, { count: lines.length - 2 })}
              </li>
            )}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-3">
            <span className="text-[13px] text-[var(--color-ink-mute)]">{t.quickBuy.total}</span>
            <span className="text-[16px] font-bold tracking-[-0.01em]">
              {formatKRW(total, lang)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--color-layer)] p-4 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
          {t.quickBuy.hint}
        </div>

        <button
          type="button"
          onClick={() => navigate.replace("/checkout", { step: "done" })}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--color-ink)] text-[14px] font-semibold text-white active:opacity-90"
        >
          {format(t.quickBuy.cta, { total: formatKRW(total, lang) })}
        </button>

        <p className="text-center text-[11.5px] text-[var(--color-ink-mute)]">
          {t.quickBuy.caption}
        </p>
      </div>
    </Screen>
  );
}
