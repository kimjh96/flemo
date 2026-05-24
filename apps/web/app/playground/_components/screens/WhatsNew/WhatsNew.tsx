import { Screen, useNavigate } from "@flemo/react";

import AppBar from "../../AppBar";
import { formatKRW, gradientFor, pick, PRODUCTS } from "../../data";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";

export default function WhatsNew() {
  const navigate = useNavigate();
  const t = useLang();
  const lang = useLangCode();
  return (
    <Screen
      backgroundColor="var(--color-surface)"
      appBar={
        <AppBar
          title={t.appBar.whatsNew}
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
      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="rounded-2xl bg-[var(--color-layer)] p-4">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">{t.whatsNew.heading}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-ink-mute)]">{t.whatsNew.sub}</p>
        </div>
        <ul className="flex flex-col gap-3">
          {PRODUCTS.slice(0, 5).map((p) => (
            <li
              key={p.id}
              className="flex gap-3 rounded-2xl bg-[var(--color-surface)] p-3 ring-1 ring-[var(--color-line)]"
            >
              <div
                className="size-20 shrink-0 overflow-hidden rounded-xl"
                style={{ background: gradientFor(p.hue) }}
              />
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]">
                    {p.brand}
                  </div>
                  <div className="text-[14px] font-semibold leading-[1.2] tracking-[-0.01em]">
                    {pick(p.name, lang)}
                  </div>
                </div>
                <div className="text-[14px] font-bold tracking-[-0.01em] text-[var(--color-brand)]">
                  {formatKRW(p.price, lang)}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-[11px] text-[var(--color-ink-mute)]">
          {t.whatsNew.caption}
        </p>
      </div>
    </Screen>
  );
}
