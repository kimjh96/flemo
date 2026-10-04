import type { MetadataRoute } from "next";

import { getDocPages } from "@/app/[lang]/docs/_data/docPages";
import { i18n } from "@/lib/i18n";

const ORIGIN = "https://flemo.dev";

const localized = (lang: string, path: string) =>
  `${ORIGIN}${lang === i18n.defaultLanguage ? "" : `/${lang}`}${path === "/" && lang !== i18n.defaultLanguage ? "" : path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/docs",
    "/playground",
    "/showcase",
    ...getDocPages("en").map((page) => `/docs/${page.slug}`)
  ];

  return paths.map((path) => ({
    url: localized(i18n.defaultLanguage, path),
    alternates: {
      languages: Object.fromEntries(i18n.languages.map((lang) => [lang, localized(lang, path)]))
    }
  }));
}
