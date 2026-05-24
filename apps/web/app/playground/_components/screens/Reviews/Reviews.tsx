import { Screen, useNavigate, useParams } from "@flemo/react";

import AppBar from "../../AppBar";
import { findProduct, pick, REVIEWS, REVIEW_SUMMARY } from "../../data";
import { format } from "../../dict";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";

export default function Reviews() {
  const navigate = useNavigate();
  const { id } = useParams<"/products/:id/reviews">();
  const product = findProduct(id);
  const t = useLang();
  const lang = useLangCode();
  const total = REVIEW_SUMMARY.breakdown.reduce((n, b) => n + b.count, 0);

  return (
    <Screen
      backgroundColor="var(--color-surface)"
      appBar={
        <AppBar
          title={t.appBar.reviews}
          showBack
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
      <div className="border-b border-[var(--color-line)] px-5 py-5">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]">
          {product.brand}
        </div>
        <div className="mt-1 text-[15px] font-semibold tracking-[-0.01em]">
          {pick(product.name, lang)}
        </div>
        <div className="mt-4 flex items-center gap-5">
          <div className="flex flex-col items-center gap-1">
            <div className="text-[36px] font-bold leading-none tracking-[-0.02em]">
              {REVIEW_SUMMARY.average.toFixed(1)}
            </div>
            <Stars value={REVIEW_SUMMARY.average} size={14} />
            <div className="text-[11.5px] text-[var(--color-ink-mute)]">
              {format(t.reviews.heading, {
                count: REVIEW_SUMMARY.count.toLocaleString(lang === "ko" ? "ko-KR" : "en-US")
              })}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {REVIEW_SUMMARY.breakdown.map((b) => (
              <div key={b.stars} className="flex items-center gap-2">
                <span className="w-4 text-[11px] text-[var(--color-ink-mute)]">{b.stars}</span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-layer)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-ink)]"
                    style={{ width: `${(b.count / total) * 100}%` }}
                  />
                </div>
                <span className="w-7 text-right text-[11px] tabular-nums text-[var(--color-ink-mute)]">
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="divide-y divide-[var(--color-line)]">
        {REVIEWS.map((r) => (
          <li key={r.id} className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size={12} />
                <span className="text-[12.5px] font-semibold">{pick(r.user, lang)}</span>
              </div>
              <span className="text-[11.5px] text-[var(--color-ink-mute)]">
                {pick(r.date, lang)}
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-[var(--color-ink-mute)]">
              {format(t.reviews.sizeRow, { size: r.size })}
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--color-ink)]">
              {pick(r.comment, lang)}
            </p>
          </li>
        ))}
      </ul>

      <div className="px-5 py-4 text-center text-[11px] text-[var(--color-ink-mute)]">
        {t.reviews.footer}
      </div>
    </Screen>
  );
}

function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          size={size}
          className={i <= Math.round(value) ? "text-[#FFB800]" : "text-[var(--color-line)]"}
        />
      ))}
    </div>
  );
}
