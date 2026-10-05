"use client";

import { useNavigate, usePathname } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import { getDocPages } from "../_data/docPages";

// The doc page a docs-Router pathname shows: /docs/router -> router, and the
// bare /docs (the section's own entry) -> introduction.
export function slugOf(pathname: string): string {
  const match = pathname.match(/^\/docs\/([^/?#]+)/);
  return match ? match[1]! : "introduction";
}

// Moves between doc pages inside the docs Router: the page turns (doc-forward /
// doc-backward, by reading order) and whatever sits around it holds still. A
// phone turns the page the same way. A doc page is a page of a site, not a
// screen of an app, so it does not push like one, and most moves come from the
// page list or the search, which cover the page and close as it turns.
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
    navigate.push(
      "/docs/:slug",
      { slug },
      { transitionName: forward ? "doc-forward" : "doc-backward" }
    );
  };
}
