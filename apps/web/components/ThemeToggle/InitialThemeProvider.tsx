"use client";

import { createContext, useContext, type PropsWithChildren } from "react";

import type { ThemeKind } from "./ThemeToggle.constants";

// The theme setting the server read from the cookie. `ThemeToggle` seeds its
// first render from this so SSR and hydration draw the same icon (no flicker,
// no hydration mismatch). Defaults to "system" for trees rendered without the
// provider.
const InitialThemeContext = createContext<ThemeKind>("system");

export function useInitialTheme() {
  return useContext(InitialThemeContext);
}

export interface InitialThemeProviderProps {
  value: ThemeKind;
}

function InitialThemeProvider({ value, children }: PropsWithChildren<InitialThemeProviderProps>) {
  return <InitialThemeContext.Provider value={value}>{children}</InitialThemeContext.Provider>;
}

export default InitialThemeProvider;
