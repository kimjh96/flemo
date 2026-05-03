import { Screen } from "flemo";

import AppBar from "../../AppBar";
import { gradientFor, pick, PRODUCTS } from "../../data";
import { useLang, useLangCode } from "../../lang";

export default function Lookbook() {
  const t = useLang();
  const lang = useLangCode();
  return (
    <Screen
      backgroundColor="var(--color-surface)"
      appBar={<AppBar title={t.appBar.lookbook} showBack bordered={false} />}
    >
      <div className="flex flex-col gap-5 px-5 pb-10 pt-2">
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]">
            {t.lookbook.eyebrow}
          </span>
          <h1 className="mt-1 text-[26px] font-bold leading-[1.2] tracking-[-0.02em]">
            {t.lookbook.heading}
          </h1>
          <p className="mt-3 text-[14px] leading-[1.7] text-[var(--color-ink-soft)]">
            {t.lookbook.body}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {PRODUCTS.slice(0, 4).map((p, i) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-line)]"
            >
              <div className="aspect-[5/3] w-full" style={{ background: gradientFor(p.hue) }} />
              <div className="flex items-baseline justify-between p-4">
                <div className="flex flex-col">
                  <span className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]">
                    LOOK 0{i + 1}
                  </span>
                  <span className="text-[15px] font-bold tracking-[-0.01em]">
                    {pick(p.name, lang)}
                  </span>
                </div>
                <span className="text-[12px] text-[var(--color-ink-mute)]">{p.brand}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-[var(--color-ink-mute)]">{t.lookbook.caption}</p>
      </div>
    </Screen>
  );
}
