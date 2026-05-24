import type { ReactNode } from "react";

import { Screen, useNavigate } from "@flemo/react";

import AppBar from "../../AppBar";
import { ACCOUNT_PROFILE, formatKRW, ORDERS, pick } from "../../data";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";
import TabBar from "../../TabBar";

export default function Account() {
  const navigate = useNavigate();
  const t = useLang();
  const lang = useLangCode();
  const profileName = pick(ACCOUNT_PROFILE.name, lang);

  return (
    <Screen
      sharedNavigationBar={<TabBar />}
      hideSystemNavigationBar
      sharedAppBar={<AppBar title={t.appBar.account} bordered={false} />}
      backgroundColor="var(--color-layer)"
    >
      <div className="flex flex-col gap-6 px-4 pb-6 pt-2">
        {/* Profile card */}
        <section className="flex items-center gap-4 rounded-3xl bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-line)]">
          <div
            className="grid size-14 shrink-0 place-items-center rounded-full text-[18px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #3B82F6 0%, #1F6FE5 100%)" }}
          >
            {profileName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[16px] font-bold tracking-[-0.01em]">
                {profileName}
              </span>
              <span className="rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {ACCOUNT_PROFILE.level}
              </span>
            </div>
            <div className="text-[12px] text-[var(--color-ink-mute)]">{ACCOUNT_PROFILE.handle}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-widest text-[var(--color-ink-mute)]">
              {t.account.point}
            </div>
            <div className="text-[14px] font-bold tracking-[-0.01em] text-[var(--color-brand)]">
              {ACCOUNT_PROFILE.point.toLocaleString(lang === "ko" ? "ko-KR" : "en-US")}
            </div>
          </div>
        </section>

        {/* Orders */}
        <section>
          <div className="mb-2 flex items-end justify-between px-1">
            <h3 className="text-[15px] font-bold tracking-[-0.01em]">{t.account.recentOrders}</h3>
            <span className="text-[11.5px] text-[var(--color-ink-mute)]">{t.account.seeAll}</span>
          </div>
          <ul className="overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-line)]">
            {ORDERS.map((o, i) => (
              <li
                key={o.id}
                className={`flex items-start gap-3 p-4 ${i !== 0 ? "border-t border-[var(--color-line)]" : ""}`}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-layer)] text-[var(--color-ink-soft)]">
                  <Icon name="bag" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold">
                      {pick(o.itemSummary, lang)}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-[var(--color-ink-mute)]">
                      {pick(o.date, lang)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[var(--color-ink-mute)]">
                      {t.account.orderStatus[o.status]}
                    </span>
                    <span className="font-medium text-[var(--color-ink)]">
                      {formatKRW(o.total, lang)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Settings groups */}
        <Group title={t.account.groups.appearance}>
          <Row label={t.account.rows.theme.label} value={t.account.rows.theme.value} />
          <Row label={t.account.rows.language.label} value={t.account.rows.language.value} />
        </Group>

        <Group title={t.account.groups.notifications}>
          <Row label={t.account.rows.push.label} value={t.account.rows.push.value} />
          <Row label={t.account.rows.email.label} value={t.account.rows.email.value} />
        </Group>

        <Group title={t.account.groups.security}>
          <Row
            label={t.account.rows.password.label}
            value={t.account.rows.password.value}
            onClick={() => navigate.replace("/login", undefined, { transitionName: "fade" })}
          />
        </Group>

        <Group title={t.account.groups.support}>
          <Row label={t.account.rows.helpCenter.label} value={t.account.rows.helpCenter.value} />
          <Row label={t.account.rows.terms.label} value="" />
          <Row label={t.account.rows.privacy.label} value="" />
        </Group>

        <div className="px-4 pt-2 text-center text-[11px] text-[var(--color-ink-mute)]">
          {t.account.version}
        </div>
      </div>
    </Screen>
  );
}

interface GroupProps {
  title: string;
  children: ReactNode;
}

function Group({ title, children }: GroupProps) {
  return (
    <section>
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-ink-mute)]">
        {title}
      </div>
      <ul className="overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-line)]">
        {children}
      </ul>
    </section>
  );
}

interface RowProps {
  label: string;
  value: string;
  onClick?: () => void;
}

function Row({ label, value, onClick }: RowProps) {
  return (
    <li className="border-b border-[var(--color-line)] last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left active:bg-[var(--color-layer)]"
      >
        <span className="text-[14px] text-[var(--color-ink)]">{label}</span>
        <span className="flex items-center gap-1.5">
          {value && <span className="text-[13px] text-[var(--color-ink-mute)]">{value}</span>}
          <Icon name="forward" size={14} className="text-[var(--color-ink-mute)]" />
        </span>
      </button>
    </li>
  );
}
