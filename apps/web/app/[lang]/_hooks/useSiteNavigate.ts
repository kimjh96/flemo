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
//               a search result). On a wide screen the page is shoved a full
//               width (site-drill); on a phone it is the cupertino push, so
//               the visitor can swipe back to where they came from.
//
// Both are no-ops when the destination is already on screen.
const PHONE = "(max-width: 767px)";

function drillTransition() {
  const phone = typeof window !== "undefined" && window.matchMedia(PHONE).matches;
  return phone ? "cupertino" : "site-drill";
}

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
    navigate.push("/docs/:slug", { slug }, { transitionName: drillTransition() });
  };

  const drillIntoPlayground = () => {
    if (pathname === "/playground") return;
    navigate.push("/playground", {}, { transitionName: drillTransition() });
  };

  return { pathname, section, goSection, drillIntoDocs, drillIntoPlayground };
}
