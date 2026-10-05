"use client";

import { useEffect, useState, type RefObject } from "react";

export interface DocsTocProps {
  title: string;
  headings: { text: string; id: string }[];
  // The page's scroller: headings are observed against it, not the window.
  scrollRef: RefObject<HTMLElement | null>;
}

const plain = (text: string) => text.replace(/`/g, "");

// "On this page", with the section in view marked. Clicking scrolls the page's
// own scroller; the URL is left alone so the docs Router's history stays the
// reader's page history.
function DocsToc({ title, headings, scrollRef }: DocsTocProps) {
  const [active, setActive] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || headings.length === 0) return undefined;
    const onScroll = () => {
      const top = root.getBoundingClientRect().top + 120;
      let current = headings[0]!.id;
      for (const heading of headings) {
        const element = root.querySelector<HTMLElement>(`#${CSS.escape(heading.id)}`);
        if (element && element.getBoundingClientRect().top <= top) current = heading.id;
      }
      setActive(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [headings, scrollRef]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label={title} className="flex flex-col gap-1">
      <p className="label mb-2 text-fg-subtle">{title}</p>
      {headings.map((heading) => (
        <button
          key={heading.id}
          type="button"
          onClick={() => {
            const root = scrollRef.current;
            const element = root?.querySelector<HTMLElement>(`#${CSS.escape(heading.id)}`);
            if (root && element) {
              root.scrollTo({ top: element.offsetTop - 24, behavior: "smooth" });
            }
          }}
          className={`border-l py-1 pl-3 text-left text-sm transition-colors ${
            active === heading.id
              ? "border-accent text-fg"
              : "border-line text-fg-subtle hover:text-fg-muted"
          }`}
        >
          {plain(heading.text)}
        </button>
      ))}
    </nav>
  );
}

export default DocsToc;
