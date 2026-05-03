import { Screen, useNavigate } from "flemo";

import { useLang } from "../../lang";

export default function Login() {
  const navigate = useNavigate();
  const t = useLang();

  return (
    <Screen backgroundColor="var(--color-surface)">
      <div className="flex h-full flex-col items-center justify-center gap-8 px-8">
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-16 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #191F28 0%, #3B5170 100%)"
            }}
          />
          <div className="text-[24px] font-bold tracking-[-0.025em]">{t.login.title}</div>
          <div className="text-center text-[14px] leading-relaxed text-[var(--color-ink-mute)]">
            {t.login.subtitle}
          </div>
        </div>
        <div className="flex w-full max-w-[320px] flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate.replace("/", undefined, { transitionName: "fade" })}
            className="flex h-12 items-center justify-center rounded-2xl bg-[var(--color-ink)] text-[14px] font-semibold text-white active:opacity-85"
          >
            {t.login.google}
          </button>
          <button
            type="button"
            onClick={() => navigate.replace("/", undefined, { transitionName: "fade" })}
            className="flex h-12 items-center justify-center rounded-2xl border border-[var(--color-line)] text-[14px] font-semibold text-[var(--color-ink)] active:bg-[var(--color-layer)]"
          >
            {t.login.apple}
          </button>
          <button
            type="button"
            onClick={() => navigate.replace("/", undefined, { transitionName: "fade" })}
            className="flex h-12 items-center justify-center rounded-2xl border border-[var(--color-line)] text-[14px] font-semibold text-[var(--color-ink)] active:bg-[var(--color-layer)]"
          >
            {t.login.email}
          </button>
        </div>
        <p className="max-w-[300px] px-4 text-center text-[11.5px] leading-relaxed text-[var(--color-ink-mute)]">
          {t.login.footer}
        </p>
      </div>
    </Screen>
  );
}
