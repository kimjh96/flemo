import FeatureIcon from "./FeatureIcon";

import type { FeatureItem } from "./HomeFeatures.types";

export interface HomeFeaturesProps {
  items: ReadonlyArray<FeatureItem>;
}

function HomeFeatures({ items }: HomeFeaturesProps) {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[1240px] px-6 py-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-7 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 transition-colors hover:border-[var(--color-text-secondary)]"
            >
              <div
                className="flex size-11 items-center justify-center rounded-xl text-white"
                style={{ background: "var(--color-primary)" }}
              >
                <FeatureIcon icon={item.icon} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-[18px] font-bold tracking-[-0.01em] text-[var(--color-text-primary)]">
                  {item.label}
                </h3>
                <p className="text-[14.5px] leading-[1.65] text-[var(--color-text-secondary)]">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeFeatures;
