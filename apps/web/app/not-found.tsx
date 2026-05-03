import Link from "next/link";
import { cookies, headers } from "next/headers";

import { getDict, i18n } from "@/lib/i18n";

async function detectLang(): Promise<string> {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLang && i18n.languages.includes(cookieLang)) return cookieLang;

  const headerStore = await headers();
  const accept = headerStore.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const primary = tag.split("-")[0];
    if (i18n.languages.includes(primary)) return primary;
  }

  return i18n.defaultLanguage;
}

export default async function NotFound() {
  const lang = await detectLang();
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
