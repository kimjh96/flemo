"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { i18n, localeNames } from "@/lib/i18n";

export interface LanguageToggleProps {
  lang: string;
  // When provided, the toggle switches language in place (no navigation) instead
  // of linking to the locale-prefixed path.
  onToggle?: () => void;
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

export default function LanguageToggle({ lang, onToggle }: LanguageToggleProps) {
  const pathname = usePathname();
  const otherLang = lang === "ko" ? "en" : "ko";
  const label = localeNames[otherLang] ?? otherLang;
  const className =
    "ml-1 cursor-pointer rounded-full bg-[var(--color-neutral-200)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-300)]";

  if (onToggle) {
    return (
      <button type="button" onClick={onToggle} className={className}>
        {label}
      </button>
    );
  }

  const base = stripLocale(pathname);
  const href =
    otherLang === i18n.defaultLanguage
      ? base
      : base === "/"
        ? `/${otherLang}`
        : `/${otherLang}${base}`;

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
