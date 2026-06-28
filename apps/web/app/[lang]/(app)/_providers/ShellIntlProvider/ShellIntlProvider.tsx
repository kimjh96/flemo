"use client";

import { createContext, useContext, type PropsWithChildren } from "react";

import { getDict } from "@/lib/i18n";

// The shell mounts a client-side flemo Router that rewrites its own history, so
// its screens render outside the normal server render where `params.lang` is
// available. This provider carries the locale down as context: the page reads
// `params.lang` on the server and feeds it here. `useShellLang` returns the
// locale (for building zone-boundary hrefs like /docs vs /ko/docs), and
// `useShellDict` returns the `app` slice of the shared `dict`, so every shell
// screen and the header localize without prop-drilling through the Router.
const ShellLangContext = createContext<string>("en");

export interface ShellIntlProviderProps {
  lang: string;
}

function ShellIntlProvider({ lang, children }: PropsWithChildren<ShellIntlProviderProps>) {
  return <ShellLangContext.Provider value={lang}>{children}</ShellLangContext.Provider>;
}

export function useShellLang() {
  return useContext(ShellLangContext);
}

export function useShellDict() {
  return getDict(useShellLang()).app;
}

export default ShellIntlProvider;
