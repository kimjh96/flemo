"use client";

import { createContext, useContext, type PropsWithChildren } from "react";

import { getDict } from "@/lib/i18n";

// The playground is a standalone client island at /playground (outside the
// `[lang]` route tree), so it has no next-intl/Fumadocs locale context. It
// receives the locale as a `?lang=` query (the hero iframes
// `/playground?lang=ko`), which the page reads and feeds here. This provider
// exposes the playground slice of the shared `dict` so the in-app UI labels
// localize; fake demo content (album/artist/song names) stays as-is.
type PlaygroundDict = ReturnType<typeof getDict>["playground"];

const PlaygroundIntlContext = createContext<PlaygroundDict>(getDict("en").playground);

export interface PlaygroundIntlProviderProps {
  lang: string;
}

function PlaygroundIntlProvider({
  lang,
  children
}: PropsWithChildren<PlaygroundIntlProviderProps>) {
  return (
    <PlaygroundIntlContext.Provider value={getDict(lang).playground}>
      {children}
    </PlaygroundIntlContext.Provider>
  );
}

export function usePlaygroundDict() {
  return useContext(PlaygroundIntlContext);
}

export default PlaygroundIntlProvider;
