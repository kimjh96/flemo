"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { i18n, localeNames } from "@/lib/i18n";

export interface LanguageToggleProps {
  lang: string;
}

// Swap the locale on the *current* path instead of sending the user home.
// `/showcase` <-> `/ko/showcase`, `/` <-> `/ko`, and so on. The default locale
// (en) is served without a prefix, so switching to it drops the segment.
function stripLocale(pathname: string) {
  for (const code of i18n.languages) {
    if (pathname === `/${code}`) return "/";
    if (pathname.startsWith(`/${code}/`)) return pathname.slice(code.length + 1);
  }
  return pathname;
}

export default function LanguageToggle({ lang }: LanguageToggleProps) {
  const pathname = usePathname();
  const otherLang = lang === "ko" ? "en" : "ko";
  const base = stripLocale(pathname);

  const href =
    otherLang === i18n.defaultLanguage
      ? base
      : base === "/"
        ? `/${otherLang}`
        : `/${otherLang}${base}`;

  return (
    <Link
      href={href}
      className="ml-1 rounded-full bg-[var(--color-neutral-200)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-300)]"
    >
      {localeNames[otherLang] ?? otherLang}
    </Link>
  );
}
