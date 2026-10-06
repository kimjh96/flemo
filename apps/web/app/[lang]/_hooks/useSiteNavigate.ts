"use client";

import { useNavigate, usePathname } from "@flemo/react";

// The site's top-level sections in header order. The order decides which way a
// lateral move slides: a section to the right enters from the right.
export const SECTION_ORDER = ["/", "/docs", "/playground", "/showcase"] as const;

export type SectionPath = (typeof SECTION_ORDER)[number];

export function sectionOf(pathname: string): SectionPath {
  for (const path of [...SECTION_ORDER].reverse()) {
    if (path !== "/" && (pathname === path || pathname.startsWith(`${path}/`))) return path;
  }
  return "/";
}

// Two ways to move around the site, and they are not the same gesture:
//
//   goSection   a peer move from the header. Lateral, short, no swipe.
//   drillInto   going deeper from inside a page (a call to action, a card,
//               a search result). The page is shoved a full width
//               (site-drill), on a phone as on a wide screen: this is a
//               site, so going deeper never borrows an app screen's push.
//
// Both are no-ops when the destination is already on screen.
export default function useSiteNavigate() {
  const navigate = useNavigate();
  const pathname = usePathname();
  const section = sectionOf(pathname);

  const goSection = (target: SectionPath) => {
    if (pathname === target) return;
    const forward = SECTION_ORDER.indexOf(target) > SECTION_ORDER.indexOf(section);
    navigate.push(target, {}, { transitionName: forward ? "site-forward" : "site-backward" });
  };

  const drillIntoDocs = (slug: string) => {
    navigate.push("/docs/:slug", { slug }, { transitionName: "site-drill" });
  };

  const drillIntoPlayground = () => {
    if (pathname === "/playground") return;
    navigate.push("/playground", {}, { transitionName: "site-drill" });
  };

  return { pathname, section, goSection, drillIntoDocs, drillIntoPlayground };
}
