import { Screen, useNavigate } from "flemo";

import AppBar from "../../AppBar";
import { SIZE_CHART } from "../../data";
import Icon from "../../Icon";
import { useLang } from "../../lang";

export default function SizeGuide() {
  const navigate = useNavigate();
  const t = useLang();

  return (
    <Screen
      backgroundColor="var(--color-surface)"
      appBar={
        <AppBar
          title={t.appBar.sizeGuide}
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
      <div className="px-5 py-5">
        <div className="rounded-2xl bg-[var(--color-layer)] p-4 text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
          {t.sizeGuide.intro}
        </div>

        <table className="mt-4 w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-[var(--color-ink-mute)]">
              <th className="border-b border-[var(--color-line)] py-2 pr-2 font-semibold">
                {t.sizeGuide.headers.size}
              </th>
              <th className="border-b border-[var(--color-line)] px-2 py-2 font-semibold">
                {t.sizeGuide.headers.chest}
              </th>
              <th className="border-b border-[var(--color-line)] px-2 py-2 font-semibold">
                {t.sizeGuide.headers.length}
              </th>
              <th className="border-b border-[var(--color-line)] py-2 pl-2 font-semibold">
                {t.sizeGuide.headers.sleeve}
              </th>
            </tr>
          </thead>
          <tbody>
            {SIZE_CHART.map((row) => (
              <tr key={row.size}>
                <td className="border-b border-[var(--color-line)] py-3 pr-2 font-semibold tracking-[-0.01em]">
                  {row.size}
                </td>
                <td className="border-b border-[var(--color-line)] px-2 py-3 tabular-nums">
                  {row.chest} cm
                </td>
                <td className="border-b border-[var(--color-line)] px-2 py-3 tabular-nums">
                  {row.length} cm
                </td>
                <td className="border-b border-[var(--color-line)] py-3 pl-2 tabular-nums">
                  {row.sleeve} cm
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--color-line)] p-4">
          <Icon name="ruler" size={20} className="mt-0.5 text-[var(--color-ink-soft)]" />
          <div className="text-[12.5px] leading-relaxed text-[var(--color-ink-soft)]">
            {t.sizeGuide.tip}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--color-ink-mute)]">
          {t.sizeGuide.footer}
        </p>
      </div>
    </Screen>
  );
}
