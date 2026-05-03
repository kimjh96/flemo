"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useEffect } from "react";

import { getDict, i18n } from "@/lib/i18n";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang ?? i18n.defaultLanguage;
  const t = getDict(lang).error;
  const homeHref = lang === i18n.defaultLanguage ? "/" : `/${lang}`;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="flex max-w-[480px] flex-col items-center text-center">
        <div className="text-[112px] font-bold leading-none tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-[140px]">
          500
        </div>
        <h1 className="mt-4 text-[24px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[28px]">
          {t.title}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-text-secondary)]">
          {t.body}
        </p>
        {error.digest && (
          <code className="mt-3 rounded-md bg-[var(--color-layer)] px-2 py-1 font-mono text-[11.5px] text-[var(--color-text-secondary)]">
            {error.digest}
          </code>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => reset()} className="cta-pill">
            {t.cta}
          </button>
          <Link href={homeHref} className="cta-ghost">
            {t.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
