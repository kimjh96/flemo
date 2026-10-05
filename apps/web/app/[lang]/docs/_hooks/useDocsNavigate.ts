"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import { getDocPages } from "../_data/docPages";

const PHONE = "(max-width: 767px)";

// The doc page a docs-Router pathname shows: /docs/router -> router, and the
// bare /docs (the section's own entry) -> introduction.
export function slugOf(pathname: string): string {
  const match = pathname.match(/^\/docs\/([^/?#]+)/);
  return match ? match[1]! : "introduction";
}

// Moves between doc pages inside the docs Router. On a wide screen the sidebar
// stays and the page turns (doc-forward / doc-backward, by reading order). On a
// phone there is no sidebar to hold still, so a page pushes like an app screen
// with cupertino, and the edge swipe takes the reader back.
export default function useDocsNavigate() {
  const navigate = useNavigate();
  // Read from the docs Router's pathname, not from screen params: the sidebar
  // calls this from outside any docs Screen, where useParams would answer with
  // the enclosing site screen's params, fixed at the moment the docs opened.
  const pathname = usePathname();
  const lang = useShellLang();
  const current = slugOf(pathname);

  return (slug: string) => {
    if (slug === current) return;
    const order = getDocPages(lang).map((page) => page.slug);
    const forward = order.indexOf(slug) >= order.indexOf(current);
    const phone = typeof window !== "undefined" && window.matchMedia(PHONE).matches;
    navigate.push(
      "/docs/:slug",
      { slug },
      { transitionName: phone ? "cupertino" : forward ? "doc-forward" : "doc-backward" }
    );
  };
}
