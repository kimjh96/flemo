import DocsNav from "../DocsNav";

// The persistent docs sidebar (desktop). It lives OUTSIDE the content <Slot>, so
// it stays put while only the page area transitions. Hidden on mobile, where the
// same nav opens as a sheet from the page (see DocsNavSheet).
function DocsSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--color-border-light)] px-4 pt-24 pb-12 md:block">
      <DocsNav />
    </aside>
  );
}

export default DocsSidebar;
