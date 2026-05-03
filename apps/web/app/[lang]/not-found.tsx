"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { getDict, i18n } from "@/lib/i18n";

export default function NotFound() {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang ?? i18n.defaultLanguage;
  const t = getDict(lang).notFound;
  const homeHref = lang === i18n.defaultLanguage ? "/" : `/${lang}`;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="flex max-w-[480px] flex-col items-center text-center">
        <div className="text-[112px] font-bold leading-none tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-[140px]">
          404
        </div>
        <h1 className="mt-4 text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[28px]">
          {t.title}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
          {t.body}
        </p>
        <Link href={homeHref} className="cta-pill mt-8">
          {t.cta}
        </Link>
      </div>
    </main>
  );
}
