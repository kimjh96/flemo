import { useState } from "react";

import { Screen, useNavigate } from "flemo";

import AppBar from "../../AppBar";
import { findProduct, formatKRW, gradientFor, INITIAL_CART, pick, type CartItem } from "../../data";
import { format } from "../../dict";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";
import TabBar from "../../TabBar";

export default function Cart() {
  const navigate = useNavigate();
  const t = useLang();
  const lang = useLangCode();
  const [items, setItems] = useState<CartItem[]>(INITIAL_CART);

  const lines = items
    .map((item) => {
      const product = findProduct(item.productId);
      return { item, product };
    })
    .filter((line) => Boolean(line.product));

  const subtotal = lines.reduce((n, l) => n + l.product.price * l.item.quantity, 0);
  const shipping = subtotal >= 50000 ? 0 : 3000;
  const total = subtotal + shipping;

  const updateQuantity = (idx: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((item, i) =>
          i === idx ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  return (
    <Screen
      sharedNavigationBar={<TabBar />}
      hideSystemNavigationBar
      sharedAppBar={<AppBar title={t.appBar.cart} bordered={false} />}
      backgroundColor="var(--color-layer)"
    >
      {lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-20 text-center">
          <Icon name="bag" size={36} className="text-[var(--color-ink-mute)]" />
          <div className="text-[16px] font-bold">{t.cart.empty.title}</div>
          <p className="text-[13px] text-[var(--color-ink-mute)]">{t.cart.empty.body}</p>
          <button
            type="button"
            onClick={() => navigate.replace("/", undefined, { transitionName: "fadeLeft" })}
            className="mt-3 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            {t.cart.empty.cta}
          </button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-line)] bg-[var(--color-surface)]">
            {lines.map((line, idx) => (
              <li key={`${line.item.productId}-${line.item.size}`} className="flex gap-3 p-4">
                <div
                  className="size-20 shrink-0 overflow-hidden rounded-xl"
                  style={{ background: gradientFor(line.product.hue) }}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]">
                    {line.product.brand}
                  </div>
                  <div className="text-[14px] font-semibold leading-[1.2] tracking-[-0.01em]">
                    {pick(line.product.name, lang)}
                  </div>
                  <div className="text-[12px] text-[var(--color-ink-mute)]">
                    {format(t.cart.sizeLabel, { size: line.item.size })}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <div className="text-[14px] font-bold tracking-[-0.01em]">
                      {formatKRW(line.product.price * line.item.quantity, lang)}
                    </div>
                    <div className="flex items-center rounded-full border border-[var(--color-line)]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, -1)}
                        className="flex size-7 items-center justify-center text-[var(--color-ink-soft)]"
                        aria-label="감소"
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <span className="min-w-6 text-center text-[12.5px] font-semibold">
                        {line.item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, 1)}
                        className="flex size-7 items-center justify-center text-[var(--color-ink-soft)]"
                        aria-label="증가"
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 bg-[var(--color-surface)] px-5 py-4">
            <Row label={t.cart.summarySubtotal} value={formatKRW(subtotal, lang)} />
            <Row
              label={t.cart.summaryShipping}
              value={shipping === 0 ? t.cart.shippingFree : formatKRW(shipping, lang)}
            />
            <div className="my-3 h-px bg-[var(--color-line)]" />
            <Row label={t.cart.summaryTotal} value={formatKRW(total, lang)} bold />
          </div>

          <div className="sticky bottom-0 z-10 mt-3 border-t border-[var(--color-line)] bg-[var(--color-surface)] p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
            <button
              type="button"
              onClick={() => navigate.push("/checkout", { step: "address" })}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--color-ink)] text-[14px] font-semibold text-white active:opacity-90"
            >
              {format(t.cart.checkoutCta, { total: formatKRW(total, lang) })}
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}

interface RowProps {
  label: string;
  value: string;
  bold?: boolean;
}

function Row({ label, value, bold }: RowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={`text-[13px] ${bold ? "text-[var(--color-ink)] font-semibold" : "text-[var(--color-ink-mute)]"}`}
      >
        {label}
      </span>
      <span
        className={`text-[14px] tracking-[-0.01em] ${bold ? "font-bold text-[var(--color-ink)]" : "text-[var(--color-ink)]"}`}
      >
        {value}
      </span>
    </div>
  );
}
