import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import Logo from "@/components/Logo";
import { i18n } from "@/lib/i18n";

export function baseOptions(locale: string): BaseLayoutProps {
  const isKo = locale === "ko";

  return {
    i18n,
    themeSwitch: { mode: "light-dark-system" },
    nav: {
      title: (
        <span className="flex items-center gap-2 text-base font-bold tracking-tight">
          <Logo size={22} className="rounded-[5px]" />
          <span>
            flemo
            <span className="ml-1.5 align-middle text-[10px] font-medium text-fd-muted-foreground">
              v1.5.7
            </span>
          </span>
        </span>
      ),
      url: locale === i18n.defaultLanguage ? "/" : `/${locale}`
    },
    links: [
      {
        text: isKo ? "문서" : "Docs",
        url: locale === i18n.defaultLanguage ? "/docs" : `/${locale}/docs`,
        active: "nested-url"
      },
      {
        text: isKo ? "플레이그라운드" : "Playground",
        url: `/playground?lang=${locale}`,
        active: "nested-url"
      },
      {
        text: "GitHub",
        url: "https://github.com/kimjh96/flemo",
        external: true
      }
    ]
  };
}
