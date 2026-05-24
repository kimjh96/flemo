import { RootProvider } from "fumadocs-ui/provider/next";

import { fumadocsTranslations, i18n, localeNames } from "@/lib/i18n";

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function LangLayout({ params, children }: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  return (
    <RootProvider
      theme={{ enabled: false }}
      i18n={{
        locale: lang,
        translations: fumadocsTranslations[lang],
        locales: i18n.languages.map((code) => ({
          name: localeNames[code] ?? code,
          locale: code
        }))
      }}
    >
      {children}
    </RootProvider>
  );
}
