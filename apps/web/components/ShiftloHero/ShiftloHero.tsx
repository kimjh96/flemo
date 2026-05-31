export interface ShiftloHeroProps {
  tagline: string;
  appStoreLabel: string;
  playStoreLabel: string;
}

const APP_STORE_URL = "https://apps.apple.com/kr/app/%EC%8B%9C%ED%94%8C%EB%A1%9C/id6757798018";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.shiflo&hl=ko";

export default function ShiftloHero({ tagline, appStoreLabel, playStoreLabel }: ShiftloHeroProps) {
  return (
    <div className="not-prose my-8 flex flex-col gap-6 rounded-3xl border border-[var(--color-border-light)] bg-[var(--color-layer)] p-7">
      <div className="flex items-center gap-4">
        <img
          src="/shiflo/logo.png"
          alt="shiflo"
          width={56}
          height={56}
          className="size-14 rounded-2xl border border-[var(--color-border-light)] bg-white"
        />
        <div>
          <p className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            shiflo
          </p>
          <p className="text-[var(--color-text-secondary)]">{tagline}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="cta-pill !h-12">
          {appStoreLabel}
        </a>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="cta-pill-invert !h-12 border border-[var(--color-border)]"
        >
          {playStoreLabel}
        </a>
      </div>
    </div>
  );
}
