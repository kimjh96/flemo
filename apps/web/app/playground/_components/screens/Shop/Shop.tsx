import { Screen, useNavigate } from "@flemo/react";
import { motion } from "motion/react";

import AppBar from "../../AppBar";
import { formatKRW, gradientFor, pick, PRODUCTS } from "../../data";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";
import TabBar from "../../TabBar";

export default function Shop() {
  const navigate = useNavigate();
  const t = useLang();
  const lang = useLangCode();
  const featured = PRODUCTS[0];
  const rest = PRODUCTS.slice(1);

  const open = (id: string) => () => {
    navigate.push("/products/:id", { id }, { transitionName: "layout", layoutId: id });
  };

  return (
    <Screen
      sharedNavigationBar={<TabBar />}
      hideSystemNavigationBar
      sharedAppBar={
        <AppBar
          title={
            <span className="text-[18px] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
              AURA
            </span>
          }
          bordered={false}
          trailing={
            <button
              type="button"
              onClick={() => navigate.replace("/cart", undefined, { transitionName: "fadeRight" })}
              className="flex size-10 items-center justify-center rounded-full text-[var(--color-ink)] active:opacity-60"
              aria-label="Cart"
            >
              <Icon name="cart" size={22} />
            </button>
          }
        />
      }
      backgroundColor="var(--color-layer)"
    >
      <div className="px-4 pb-6 pt-2">
        {/* Hero banner — cupertino entry */}
        <button
          type="button"
          onClick={() => navigate.push("/lookbook", undefined, { transitionName: "cupertino" })}
          className="relative mb-3 flex h-[168px] w-full items-end overflow-hidden rounded-3xl p-5 text-left text-white active:opacity-90"
          style={{ background: "linear-gradient(135deg, #191F28 0%, #3B5170 100%)" }}
        >
          <div>
            <div className="text-[11px] font-semibold tracking-widest opacity-80">
              {t.shop.heroEyebrow}
            </div>
            <h2 className="mt-1 text-[22px] font-bold leading-[1.2]">{t.shop.heroTitle}</h2>
            <p className="mt-1 text-[13px] opacity-85">{t.shop.heroSub}</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
              {t.shop.lookbookCta} →
            </span>
          </div>
          <div className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 right-2 size-28 rounded-full bg-white/10" />
        </button>

        {/* Material entry */}
        <button
          type="button"
          onClick={() => navigate.push("/whats-new", undefined, { transitionName: "material" })}
          className="mb-5 flex w-full items-center justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left active:bg-[var(--color-layer)]"
        >
          <div className="flex items-center gap-3">
            <div
              className="grid size-10 shrink-0 place-items-center rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #34A853 0%, #1F8C42 100%)" }}
            >
              <span className="text-[16px]">✨</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold tracking-[-0.01em]">{t.shop.whatsNewCta}</span>
              <span className="text-[11.5px] text-[var(--color-ink-mute)]">
                {t.shop.whatsNewDesc}
              </span>
            </div>
          </div>
          <Icon name="forward" size={16} className="text-[var(--color-ink-mute)]" />
        </button>

        {/* Featured large card */}
        <div className="mb-3">
          <div className="mb-2 flex items-end justify-between px-1">
            <h3 className="text-[15px] font-bold tracking-[-0.01em]">{t.shop.mdsPick}</h3>
            <span className="text-[11.5px] text-[var(--color-ink-mute)]">{featured.tag}</span>
          </div>
          <motion.div
            layoutId={`product-card-${featured.id}`}
            onClick={open(featured.id)}
            className="cursor-pointer overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-line)] active:opacity-90"
          >
            <motion.div
              layoutId={`product-image-container-${featured.id}`}
              className="relative overflow-hidden"
            >
              <motion.div
                layoutId={`product-image-${featured.id}`}
                className="aspect-[4/3] w-full"
                style={{ background: gradientFor(featured.hue) }}
              />
            </motion.div>
            <motion.div
              layoutId={`product-info-${featured.id}`}
              className="flex flex-col gap-1.5 p-4"
            >
              <div className="flex items-center">
                <motion.span
                  layoutId={`product-brand-${featured.id}`}
                  className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]"
                >
                  {featured.brand}
                </motion.span>
              </div>
              <div className="flex items-center">
                <motion.span
                  layoutId={`product-name-${featured.id}`}
                  className="text-[15px] font-bold leading-[1.2] tracking-[-0.01em]"
                >
                  {pick(featured.name, lang)}
                </motion.span>
              </div>
              <div className="flex items-center gap-1.5">
                <motion.span
                  layoutId={`product-price-${featured.id}`}
                  className="text-[15px] font-bold tracking-[-0.01em] text-[var(--color-brand)]"
                >
                  {formatKRW(featured.price, lang)}
                </motion.span>
                {featured.oldPrice && (
                  <span className="text-[12px] text-[var(--color-ink-mute)] line-through">
                    {formatKRW(featured.oldPrice, lang)}
                  </span>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Grid */}
        <div className="mt-5">
          <div className="mb-2 flex items-end justify-between px-1">
            <h3 className="text-[15px] font-bold tracking-[-0.01em]">{t.shop.bestSeller}</h3>
            <span className="text-[11.5px] text-[var(--color-ink-mute)]">{t.shop.seeAll}</span>
          </div>
          <motion.div className="grid grid-cols-2 gap-3">
            {rest.map((p) => (
              <motion.div
                key={p.id}
                layoutId={`product-card-${p.id}`}
                onClick={open(p.id)}
                className="cursor-pointer overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-line)] active:opacity-90"
              >
                <motion.div
                  layoutId={`product-image-container-${p.id}`}
                  className="relative overflow-hidden"
                >
                  <motion.div
                    className="aspect-square w-full"
                    style={{ background: gradientFor(p.hue) }}
                  />
                </motion.div>
                <motion.div
                  layoutId={`product-info-${p.id}`}
                  className="flex flex-col gap-0.5 px-3 py-2.5"
                >
                  <div className="flex items-center">
                    <motion.span
                      layoutId={`product-brand-${p.id}`}
                      className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-mute)]"
                    >
                      {p.brand}
                    </motion.span>
                  </div>
                  <div className="flex items-center">
                    <motion.span
                      layoutId={`product-name-${p.id}`}
                      className="text-[13px] font-bold leading-[1.2] tracking-[-0.01em]"
                    >
                      {pick(p.name, lang)}
                    </motion.span>
                  </div>
                  <div className="flex items-center gap-1">
                    <motion.span
                      layoutId={`product-price-${p.id}`}
                      className="text-[13px] font-bold tracking-[-0.01em] text-[var(--color-brand)]"
                    >
                      {formatKRW(p.price, lang)}
                    </motion.span>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </Screen>
  );
}
