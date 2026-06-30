"use client";

import DocsNav from "../DocsNav";

// The persistent docs sidebar (desktop). It lives OUTSIDE the content <Slot>, so
// it stays put while only the page area transitions. Hidden on mobile, where the
// same nav opens as a sheet from the page (see DocsNavSheet).
function DocsSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto px-3 py-12 md:block lg:py-16">
      <DocsNav />
    </aside>
  );
}

export default DocsSidebar;
