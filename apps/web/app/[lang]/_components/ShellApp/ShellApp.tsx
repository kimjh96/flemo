"use client";

import ShellIntlProvider from "@/app/[lang]/_providers/ShellIntlProvider";
import ShellRouter from "@/app/[lang]/_router/ShellRouter";

export interface ShellAppProps {
  lang: string;
  // The unprefixed path this page maps to (from the server). The Router server-
  // renders this screen, so the first paint is the right one, no blank frame.
  initPath: string;
}

// The shell's Routers work in unprefixed path space (`/`, `/docs`, ...) but use a
// locale-aware history driver (ShellRouter), so the `/ko` URL prefix stays in the
// address bar (kept for SEO) while the Router reads/writes the stripped path. No
// URL normalization here, and the locale lives in the URL, so a refresh keeps the
// language with no hydration mismatch.
function ShellApp({ lang, initPath }: ShellAppProps) {
  return (
    <ShellIntlProvider lang={lang}>
      <ShellRouter initPath={initPath} />
    </ShellIntlProvider>
  );
}

export default ShellApp;
