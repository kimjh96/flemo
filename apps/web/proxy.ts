import { NextResponse, type NextRequest } from "next/server";

import { i18n } from "@/lib/i18n";

// Locale routing. The default language (en) is served WITHOUT a
// prefix; every other language keeps its `/<lang>` prefix. Every request is
// rewritten to the internal `/[lang]/...` segment so the route's `lang` param is
// always populated, while the address bar keeps the clean URL for the default
// language. Hitting the internal `/en/...` form directly redirects to the clean
// URL so each page has one canonical address (SEO).
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const prefix = pathname.split("/")[1];

  // The locale the URL resolves to (/ko -> ko, anything else -> default),
  // surfaced as a header so the root error / not-found pages — which sit outside
  // [lang] and so have no lang param — localize by URL, not just by cookie.
  const locale =
    i18n.languages.includes(prefix) && prefix !== i18n.defaultLanguage
      ? prefix
      : i18n.defaultLanguage;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);

  // A non-default locale prefix (/ko, /ko/docs) already maps to [lang]=ko.
  if (i18n.languages.includes(prefix) && prefix !== i18n.defaultLanguage) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // The internal default-locale form is not a public URL: redirect to clean.
  if (prefix === i18n.defaultLanguage) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(i18n.defaultLanguage.length + 1) || "/";
    return NextResponse.redirect(url);
  }

  // Unprefixed (default locale): rewrite to /<default>/... so [lang] resolves.
  const url = request.nextUrl.clone();
  url.pathname = `/${i18n.defaultLanguage}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"]
};
