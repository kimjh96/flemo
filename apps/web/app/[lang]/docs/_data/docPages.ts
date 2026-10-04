import type { DocBlock, DocPage, DocSection, LocalizedDocPage } from "./docTypes";

import api from "./pages/api";
import composition from "./pages/composition";
import decorator from "./pages/decorator";
import gettingStarted from "./pages/getting-started";
import howItWorks from "./pages/how-it-works";
import introduction from "./pages/introduction";
import layer from "./pages/layer";
import morph from "./pages/morph";
import navigation from "./pages/navigation";
import part from "./pages/part";
import router from "./pages/router";
import screen from "./pages/screen";
import slot from "./pages/slot";
import transitions from "./pages/transitions";

export type { DocBlock, DocPage, DocSection } from "./docTypes";

// The docs' table of contents. One file per page under ./pages holds both
// locales; this file only decides the order and the grouping.
const OUTLINE: { title: { en: string; ko: string }; pages: LocalizedDocPage[] }[] = [
  {
    title: { en: "Getting started", ko: "Getting started" },
    pages: [introduction, howItWorks, gettingStarted]
  },
  { title: { en: "Core", ko: "Core" }, pages: [router, slot, screen, navigation] },
  {
    title: { en: "Motion", ko: "Motion" },
    pages: [transitions, decorator, part, morph, layer, composition]
  },
  { title: { en: "Reference", ko: "Reference" }, pages: [api] }
];

const localeOf = (lang: string): "en" | "ko" => (lang === "ko" ? "ko" : "en");

export function getDocSections(lang: string): DocSection[] {
  const locale = localeOf(lang);
  return OUTLINE.map((section) => ({
    title: section.title[locale],
    pages: section.pages.map((page) => page[locale])
  }));
}

export function getDocPages(lang: string): DocPage[] {
  return getDocSections(lang).flatMap((section) => section.pages);
}

export function getDocPage(lang: string, slug: string): DocPage | undefined {
  return getDocPages(lang).find((page) => page.slug === slug);
}

export function getDocSection(lang: string, slug: string): DocSection | undefined {
  return getDocSections(lang).find((section) => section.pages.some((page) => page.slug === slug));
}

export function getDocPageDescription(lang: string, slug: string): string | undefined {
  return getDocPage(lang, slug)
    ?.summary.replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// A heading's anchor id, stable across renders and locales' own text.
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// Every `h` block of a page, in order, with its anchor id.
export function pageHeadings(page: DocPage): { text: string; id: string }[] {
  return page.blocks.flatMap((block: DocBlock) =>
    block.type === "h" ? [{ text: block.text, id: headingId(block.text) }] : []
  );
}
