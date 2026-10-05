"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { usePathname, useStep } from "@flemo/react";

import Icon from "@/components/Icon";
import Kbd from "@/components/Kbd";
import useExitPresence from "@/app/[lang]/_hooks/useExitPresence";
import useSiteNavigate from "@/app/[lang]/_hooks/useSiteNavigate";
import { useDict, useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import { getDocSections, pageHeadings } from "../../_data/docPages";
import useDocsNavigate from "../../_hooks/useDocsNavigate";

const OPEN_EVENT = "flemo:docs-search";
const GO_EVENT = "flemo:docs-go";
export const ANCHOR_EVENT = "flemo:docs-anchor";

interface Entry {
  slug: string;
  anchor?: string;
  title: string;
  section: string;
  page: string;
}

// The heading a search result asked for, consumed by the doc page that mounts
// next. A module value rather than state: it crosses from the shell's Router
// into the docs Router, which share nothing else.
let pendingAnchor: { slug: string; anchor: string } | null = null;

export function takePendingAnchor(slug: string): string | null {
  if (!pendingAnchor || pendingAnchor.slug !== slug) return null;
  const { anchor } = pendingAnchor;
  pendingAnchor = null;
  return anchor;
}

export function openDocsSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const plain = (text: string) => text.replace(/`/g, "");

// Opens on the site's out curve, dropping a few pixels into place, and closes
// faster than it opens so a dismiss never waits. Under reduced motion it is
// only a fade, and still an animation, so the close still ends in the
// animationend the dialog unmounts on. Keyframes live in global.css.
const PANEL_MOTION = [
  "data-[state=open]:animate-[search-panel-in_220ms_var(--ease-out)_both]",
  "data-[state=closed]:animate-[search-panel-out_140ms_ease-in_both]",
  "motion-reduce:data-[state=open]:animate-[fade-in_220ms_var(--ease-out)_both]",
  "motion-reduce:data-[state=closed]:animate-[fade-out_140ms_ease-in_both]"
].join(" ");

// ⌘K anywhere on the site. Mounted once in the shell, outside its <Slot>.
//
// Opening a result has to reach the RIGHT Router. Inside the docs section the
// page belongs to the nested docs Router, which this component cannot address
// (names resolve to ancestors, never descendants), so it announces the slug and
// DocsSearchBridge, living inside that Router, pushes it. Anywhere else the
// shell pushes the docs section itself.
//
// Open is a flemo step (`?search=true`), so the browser's Back closes the dialog
// instead of leaving the page, the same as the mobile menu. The dialog stays
// mounted through its close animation and leaves on its `animationend`.
function DocsSearch() {
  const t = useDict();
  const lang = useShellLang();
  const pathname = usePathname();
  const { drillIntoDocs } = useSiteNavigate();
  const { step, pushStep, popStep } = useStep<{ search: boolean }>();
  const open = step?.search === true;
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  // On screen through the close animation, and rendered in the same commit
  // that opens it, so the input has the focus before the next keystroke lands.
  // The next open starts fresh.
  const { present, onAnimationEnd } = useExitPresence(open, () => {
    setQuery("");
    setCursor(0);
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(
    () =>
      getDocSections(lang).flatMap((section) =>
        section.pages.flatMap((page) => [
          { slug: page.slug, title: page.title, section: section.title, page: page.title },
          ...pageHeadings(page).map((heading) => ({
            slug: page.slug,
            anchor: heading.id,
            title: plain(heading.text),
            section: section.title,
            page: page.title
          }))
        ])
      ),
    [lang]
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries.filter((entry) => !entry.anchor);
    return entries
      .filter((entry) => `${entry.title} ${entry.page}`.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          Number(!a.title.toLowerCase().startsWith(needle)) -
          Number(!b.title.toLowerCase().startsWith(needle))
      )
      .slice(0, 12);
  }, [entries, query]);

  // The listeners outlive renders, so they read the step through refs.
  const openRef = useRef(open);
  openRef.current = open;
  const stepRef = useRef({ pushStep, popStep });
  stepRef.current = { pushStep, popStep };

  useEffect(() => {
    const show = () => {
      if (!openRef.current) void stepRef.current.pushStep({ search: true });
    };
    const onKey = (event: KeyboardEvent) => {
      // Escape closes from anywhere: the input may not have the focus.
      if (event.key === "Escape" && openRef.current) {
        // Claimed, so the mobile menu under the dialog does not close too.
        event.preventDefault();
        void stepRef.current.popStep();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (openRef.current) void stepRef.current.popStep();
        else void stepRef.current.pushStep({ search: true });
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    // Capture, so the dialog sees a key before anything under it.
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  // An open takes the focus; a close gives it back to whatever had it before.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    returnFocusRef.current?.focus?.();
    returnFocusRef.current = null;
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    if (openRef.current) void popStep();
  };

  const choose = async (entry: Entry) => {
    pendingAnchor = entry.anchor ? { slug: entry.slug, anchor: entry.anchor } : null;
    // Leave the step first, so the page is not stacked on top of the open
    // dialog's entry and Back from it does not reopen the search.
    if (openRef.current) await popStep();
    if (pathname === "/docs" || pathname.startsWith("/docs/")) {
      window.dispatchEvent(new CustomEvent(GO_EVENT, { detail: entry.slug }));
    } else {
      drillIntoDocs(entry.slug);
    }
  };

  if (!present) return null;

  const state = open ? "open" : "closed";

  return (
    <div
      data-state={state}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px] data-[state=closed]:animate-[fade-out_140ms_ease-in_both] data-[state=open]:animate-[fade-in_180ms_var(--ease-out)_both]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-label={t.app.nav.search}
        data-state={state}
        inert={!open}
        onAnimationEnd={onAnimationEnd}
        className={`flex w-full max-w-[560px] origin-top flex-col overflow-hidden rounded-xl border border-line-strong bg-surface shadow-overlay ${PANEL_MOTION}`}
      >
        <div className="flex h-12 items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={16} className="text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            placeholder={t.docs.search.placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter" && results[cursor]) {
                void choose(results[cursor]!);
              }
            }}
            className="h-full flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="no-scrollbar max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-fg-subtle">{t.docs.search.empty}</li>
          )}
          {results.map((entry, index) => (
            <li key={`${entry.slug}-${entry.anchor ?? ""}`}>
              <button
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => void choose(entry)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left ${
                  index === cursor ? "bg-surface-2" : ""
                }`}
              >
                <Icon
                  name={entry.anchor ? "chevronRight" : "book"}
                  size={14}
                  className="shrink-0 text-fg-subtle"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{entry.title}</span>
                  <span className="block truncate text-xs text-fg-subtle">
                    {entry.anchor ? `${entry.section} / ${entry.page}` : entry.section}
                  </span>
                </span>
                {index === cursor && (
                  <Icon name="arrowRight" size={14} className="text-fg-subtle" />
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {t.docs.search.hint}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            {t.docs.search.open}
          </span>
        </div>
      </div>
    </div>
  );
}

// Lives inside the docs Router and carries a search result to it.
export function DocsSearchBridge() {
  const go = useDocsNavigate();
  const goRef = useRef(go);
  goRef.current = go;

  useEffect(() => {
    const onGo = (event: Event) => {
      const slug = (event as CustomEvent<string>).detail;
      goRef.current(slug);
      // Already on that page: the page that is up takes the anchor now.
      window.dispatchEvent(new Event(ANCHOR_EVENT));
    };
    window.addEventListener(GO_EVENT, onGo);
    return () => window.removeEventListener(GO_EVENT, onGo);
  }, []);

  return null;
}

export default DocsSearch;
