"use client";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";

import DocsNav from "../DocsNav";

// The persistent docs sidebar (desktop). It lives OUTSIDE the content <Slot>, so
// it stays put while only the page area transitions. Hidden on mobile, where the
// same nav opens as a sheet from the page (see DocsNavSheet).
function DocsSidebar() {
  const isKo = useShellLang() === "ko";

  return (
    <aside className="hidden w-68 shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] px-5 pt-35 pb-12 md:block">
      <div className="mb-8 border-b border-[var(--color-border)] px-2 pb-6">
        <p className="site-overline">flemo / Docs</p>
        <h2 className="mt-2 text-[1.6rem] font-bold tracking-[-0.05em] text-[var(--color-text-primary)]">
          {isKo ? "만들기 안내" : "Build with flemo"}
        </h2>
      </div>
      <DocsNav />
    </aside>
  );
}

export default DocsSidebar;
