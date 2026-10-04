"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { buttonClass } from "@/components/Button";
import { getDict, i18n } from "@/lib/i18n";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const [lang, setLang] = useState<string>(i18n.defaultLanguage);

  useEffect(() => {
    // The /ko prefix in the URL is authoritative; anything else is the default
    // locale (the proxy serves it unprefixed), matching the rendered content.
    const segment = window.location.pathname.split("/")[1];
    if (i18n.languages.includes(segment) && segment !== i18n.defaultLanguage) {
      setLang(segment);
    }
  }, []);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = getDict(lang).error;
  const homeHref = lang === i18n.defaultLanguage ? "/" : `/${lang}`;

  const handleReset = () => reset();

  return (
    <main className="bg-grid flex min-h-[100dvh] items-center justify-center bg-bg px-6">
      <div className="flex max-w-[460px] flex-col items-center text-center">
        <p className="label flex items-center gap-2 text-fg-subtle">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" />
          500
        </p>
        <h1 className="mt-4 text-h1 text-fg">{t.title}</h1>
        <p className="mt-3 text-body text-fg-muted">{t.body}</p>
        {error.digest && (
          <code className="mt-3 rounded-xs border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-fg-muted">
            {error.digest}
          </code>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={handleReset} className={buttonClass("primary", "md")}>
            {t.cta}
          </button>
          <Link href={homeHref} className={buttonClass("ghost", "md")}>
            {t.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
