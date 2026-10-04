import Link from "next/link";
import { cookies, headers } from "next/headers";

import { buttonClass } from "@/components/Button";
import { getDict, i18n } from "@/lib/i18n";

async function detectLang(): Promise<string> {
  const headerStore = await headers();

  // The URL the request resolved to (proxy.ts), authoritative over preference.
  const urlLocale = headerStore.get("x-locale");
  if (urlLocale && i18n.languages.includes(urlLocale)) return urlLocale;

  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLang && i18n.languages.includes(cookieLang)) return cookieLang;

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
    <main className="bg-grid flex min-h-[100dvh] items-center justify-center bg-bg px-6">
      <div className="flex max-w-[460px] flex-col items-center text-center">
        <p className="font-mono text-display text-fg-subtle/40">404</p>
        <h1 className="mt-4 text-h1 text-fg">{t.title}</h1>
        <p className="mt-3 text-body text-fg-muted">{t.body}</p>
        <Link href={homeHref} className={`${buttonClass("primary", "md")} mt-8`}>
          {t.cta}
        </Link>
      </div>
    </main>
  );
}
