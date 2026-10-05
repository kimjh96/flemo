"use client";

import DocsNavList from "../DocsNavList";

// The desktop sidebar, outside the docs Router's <Slot>: it holds still while
// pages move. Hidden on a phone, where the list opens as a sheet instead.
function DocsSidebar() {
  return (
    <aside className="no-scrollbar hidden h-full w-[248px] shrink-0 overflow-y-auto border-r border-line pt-8 pr-4 pl-3 sm:pl-3 pb-12 md:block">
      <DocsNavList />
    </aside>
  );
}

export default DocsSidebar;
