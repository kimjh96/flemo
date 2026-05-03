interface HeroDemoProps {
  lang: string;
}

export default function HeroDemo({ lang }: HeroDemoProps) {
  return (
    <div className="relative mx-auto h-[640px] w-[300px] sm:h-[700px] sm:w-[330px]">
      <div className="absolute inset-0 rounded-[44px] bg-[#191f28] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/40 dark:ring-white/10" />
      <div className="absolute inset-[5px] overflow-hidden rounded-[40px] bg-white">
        <iframe
          src={`/playground?lang=${lang}`}
          title="flemo live demo"
          className="absolute inset-0 h-full w-full border-0"
          loading="eager"
          tabIndex={-1}
        />
        <div className="pointer-events-none absolute left-1/2 top-2 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-[#191f28]" />
      </div>
    </div>
  );
}
