import { createBrowserHistoryDriver, type HistoryDriver } from "@flemo/react";

import { i18n } from "@/lib/i18n";

// Drop a leading locale segment: /ko/docs -> /docs, /ko -> /.
function stripLocale(pathname: string): string {
  for (const code of i18n.languages) {
    if (pathname === `/${code}`) return "/";
    if (pathname.startsWith(`/${code}/`)) return pathname.slice(code.length + 1);
  }
  return pathname;
}

// Add the current locale prefix to an unprefixed URL, preserving any query. The
// default locale stays unprefixed (i18n hideLocale: "default-locale").
function addLocale(url: string, locale: string): string {
  if (locale === i18n.defaultLanguage) return url;
  const [path, query] = url.split("?");
  const prefixed = path === "/" ? `/${locale}` : `/${locale}${path}`;
  return query ? `${prefixed}?${query}` : prefixed;
}

// A history driver that keeps the locale prefix in the URL while the Router works
// in unprefixed path space: it strips the prefix when the Router reads the
// location and adds the CURRENT locale when the Router writes it. The locale is
// read live (getLocale), so a language toggle re-prefixes later navigations.
// Wraps the keyed browser driver, so multiple Routers still namespace their
// history.state correctly.
export default function createLocaleHistoryDriver(
  routerKey: string | undefined,
  getLocale: () => string
): HistoryDriver {
  const base = createBrowserHistoryDriver(routerKey);

  return {
    readState: base.readState,
    readPathname: () => stripLocale(base.readPathname()),
    pushState: (state, url) => base.pushState(state, addLocale(url, getLocale())),
    replaceState: (state, url) => base.replaceState(state, addLocale(url, getLocale())),
    go: base.go,
    back: base.back,
    subscribe: (listener) =>
      base.subscribe((event) => listener({ ...event, pathname: stripLocale(event.pathname) }))
  };
}
