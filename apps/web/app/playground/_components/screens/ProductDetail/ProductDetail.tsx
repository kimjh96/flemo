import { useState } from "react";

import { LayoutConfig, LayoutScreen, useNavigate, useParams, useScreen } from "@flemo/react";
import { motion } from "motion/react";

import { findProduct, formatKRW, gradientFor, pick, REVIEW_SUMMARY } from "../../data";
import { format } from "../../dict";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";

export default function ProductDetail() {
  const navigate = useNavigate();
  const { id } = useParams<"/products/:id">();
  const { layoutId } = useScreen();
  const product = findProduct(id);
  const t = useLang();
  const lang = useLangCode();
  const [size, setSize] = useState(product.sizes[0]);

  return (
    <LayoutScreen>
      <LayoutConfig>
        <motion.div
          layoutId={`product-card-${layoutId}`}
          className="fixed inset-0 overflow-y-auto overscroll-y-contain bg-[var(--color-surface)] pb-[120px]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Floating top bar */}
          <motion.div
            className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
          >
            <button
              type="button"
              onClick={() => navigate.pop()}
              className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md active:opacity-70"
              aria-label="Back"
            >
              <Icon name="back" size={20} />
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md active:opacity-70"
                aria-label="Like"
              >
                <Icon name="heart" size={18} />
              </button>
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md active:opacity-70"
                aria-label="Share"
              >
                <Icon name="share" size={18} />
              </button>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            layoutId={`product-image-container-${layoutId}`}
            className="relative overflow-hidden"
          >
            <motion.div
              layoutId={`product-image-${layoutId}`}
              className="aspect-square w-full"
              style={{ background: gradientFor(product.hue) }}
            />
          </motion.div>

          {/* Info */}
          <motion.div
            layoutId={`product-info-${layoutId}`}
            className="relative -mt-6 flex flex-col gap-2 rounded-t-3xl bg-[var(--color-surface)] px-5 pb-6 pt-6 shadow-[0_-12px_24px_-12px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-center">
              <motion.span
                layoutId={`product-brand-${layoutId}`}
                className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]"
              >
                {product.brand}
              </motion.span>
            </div>
            <div className="flex items-center">
              <motion.span
                layoutId={`product-name-${layoutId}`}
                className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--color-ink)]"
              >
                {pick(product.name, lang)}
              </motion.span>
            </div>
            <div className="flex items-baseline gap-2">
              <motion.span
                layoutId={`product-price-${layoutId}`}
                className="text-[22px] font-bold tracking-[-0.02em] text-[var(--color-brand)]"
              >
                {formatKRW(product.price, lang)}
              </motion.span>
              {product.oldPrice && (
                <>
                  <span className="text-[14px] text-[var(--color-ink-mute)] line-through">
                    {formatKRW(product.oldPrice, lang)}
                  </span>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-500">
                    -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                  </span>
                </>
              )}
            </div>
          </motion.div>

          <div className="border-t border-[var(--color-line)] px-5 py-6">
            <p className="text-[14px] leading-[1.65] text-[var(--color-ink-soft)]">
              {pick(product.description, lang)}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate.push("/products/:id/reviews", { id }, { transitionName: "cupertino" })
            }
            className="flex w-full items-center justify-between border-t border-[var(--color-line)] px-5 py-5 text-left active:bg-[var(--color-layer)]"
          >
            <div className="flex items-center gap-3">
              <Icon name="star" size={18} className="text-[#FFB800]" />
              <div className="flex flex-col">
                <span className="text-[13px] font-bold tracking-[-0.01em]">
                  {format(t.product.reviewsLine, {
                    count: REVIEW_SUMMARY.count.toLocaleString(lang === "ko" ? "ko-KR" : "en-US")
                  })}
                </span>
                <span className="text-[11.5px] text-[var(--color-ink-mute)]">
                  {format(t.product.reviewsHint, {
                    avg: REVIEW_SUMMARY.average.toFixed(1)
                  })}
                </span>
              </div>
            </div>
            <Icon name="forward" size={16} className="text-[var(--color-ink-mute)]" />
          </button>

          <div className="border-t border-[var(--color-line)] px-5 py-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-bold tracking-[-0.01em]">
                {t.product.sizeHeading}
              </span>
              <button
                type="button"
                onClick={() =>
                  navigate.push("/size-guide", undefined, { transitionName: "material" })
                }
                className="flex items-center gap-1 text-[12px] font-semibold text-[var(--color-ink-soft)] underline-offset-2 active:opacity-60"
              >
                <Icon name="ruler" size={13} />
                {t.product.sizeGuide}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => {
                const active = s === size;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`min-w-[52px] rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${
                      active
                        ? "bg-[var(--color-ink)] text-white"
                        : "bg-[var(--color-layer)] text-[var(--color-ink-soft)] active:bg-[var(--color-line)]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Sticky bottom CTA */}
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 flex gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface)] p-3 pb-[max(env(safe-area-inset-bottom),12px)]"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <button
            type="button"
            onClick={() => navigate.replace("/cart", undefined, { transitionName: "fadeRight" })}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-[var(--color-layer)] text-[14px] font-semibold text-[var(--color-ink)] active:opacity-80"
          >
            {t.product.addToCart}
          </button>
          <button
            type="button"
            onClick={() => navigate.push("/quick-buy", undefined, { transitionName: "material" })}
            className="flex h-12 flex-[1.2] items-center justify-center rounded-2xl bg-[var(--color-ink)] text-[14px] font-semibold text-white active:opacity-90"
          >
            {t.product.buyNow}
          </button>
        </motion.div>
      </LayoutConfig>
    </LayoutScreen>
  );
}
