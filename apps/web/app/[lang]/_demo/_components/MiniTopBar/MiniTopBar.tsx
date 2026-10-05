import type { ReactNode } from "react";

import { Part } from "@flemo/react";

export interface MiniTopBarProps {
  title: string;
  action: ReactNode;
}

// The shared top bar. Each screen renders its own copy with the same
// `sharedTopBarId`, so the bar's shell holds still across the push while the
// title and action, wrapped in Parts, hand over to the next screen.
function MiniTopBar({ title, action }: MiniTopBarProps) {
  return (
    <div className="grid h-12 grid-cols-[40px_minmax(0,1fr)_40px] items-center border-b border-line bg-bg px-2">
      <Part name="mini-bar-action" className="grid size-10 place-items-center">
        {action}
      </Part>
      <Part name="mini-bar-title" className="min-w-0 text-center">
        <p className="truncate text-[0.9375rem] font-semibold tracking-[-0.015em] text-fg">
          {title}
        </p>
      </Part>
      <span />
    </div>
  );
}

export default MiniTopBar;
