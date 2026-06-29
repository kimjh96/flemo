"use client";

import { createContext, useContext, useRef, useState, type PropsWithChildren } from "react";

import { getDict, i18n } from "@/lib/i18n";

// The shell mounts a client-side flemo Router that rewrites its own history, so
// its screens render outside the normal server render where `params.lang` is
// available. This provider carries the locale down as context: the page reads
// `params.lang` on the server (from the URL prefix) and feeds it here.
// `useShellLang` returns the locale, `useShellDict` returns the `app` slice of
// the shared `dict`, and `useShellLocaleGetter` hands the locale-aware history
// driver a live read of the current locale.
const ShellLangContext = createContext<string>("en");
const ShellToggleLangContext = createContext<() => void>(() => {});
const ShellLocaleGetterContext = createContext<() => string>(() => i18n.defaultLanguage);

// Re-localize the current URL path for a new locale: strip any existing prefix,
// then add the new one (the default locale stays unprefixed).
function reLocalizePath(pathname: string, locale: string): string {
  let stripped = pathname;
  for (const code of i18n.languages) {
    if (pathname === `/${code}`) {
      stripped = "/";
      break;
    }
    if (pathname.startsWith(`/${code}/`)) {
      stripped = pathname.slice(code.length + 1);
      break;
    }
  }
  if (locale === i18n.defaultLanguage) return stripped;
  return stripped === "/" ? `/${locale}` : `/${locale}${stripped}`;
}

export interface ShellIntlProviderProps {
  lang: string;
}

// `lang` is held in client state, seeded from the server `params.lang` (the URL
// prefix). The toggle flips it in place AND re-prefixes the address bar, so the
// locale stays in the URL (the locale-aware driver maps it) and a refresh keeps
// the language with no localStorage and no hydration mismatch. `langRef` gives
// the driver a stable live getter that the toggle updates.
function ShellIntlProvider({
  lang: initialLang,
  children
}: PropsWithChildren<ShellIntlProviderProps>) {
  const [lang, setLang] = useState(initialLang);

  const langRef = useRef(lang);
  langRef.current = lang;
  const getLocale = useRef(() => langRef.current).current;

  const toggleLang = () => {
    const next = lang === "ko" ? "en" : "ko";
    setLang(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        reLocalizePath(window.location.pathname, next)
      );
    }
  };

  return (
    <ShellLangContext.Provider value={lang}>
      <ShellToggleLangContext.Provider value={toggleLang}>
        <ShellLocaleGetterContext.Provider value={getLocale}>
          {children}
        </ShellLocaleGetterContext.Provider>
      </ShellToggleLangContext.Provider>
    </ShellLangContext.Provider>
  );
}

export function useShellLang() {
  return useContext(ShellLangContext);
}

export function useToggleShellLang() {
  return useContext(ShellToggleLangContext);
}

export function useShellLocaleGetter() {
  return useContext(ShellLocaleGetterContext);
}

export function useShellDict() {
  return getDict(useShellLang()).app;
}

export default ShellIntlProvider;
