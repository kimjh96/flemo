import type { ReactNode } from "react";

import { Part } from "@flemo/react";

export interface CompositionHeaderProps {
  action: ReactNode;
  eyebrow: string;
  title: string;
}

function CompositionHeader({ action, eyebrow, title }: CompositionHeaderProps) {
  return (
    <header
      data-composition-header=""
      className="grid h-[74px] grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 border-b border-slate-200 bg-white px-3 text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
    >
      <span className="grid size-11 place-items-center">
        <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-indigo-500 text-white shadow-md shadow-indigo-500/25">
          <Part name="composition-header-action" className="grid size-full place-items-center">
            {action}
          </Part>
        </span>
      </span>
      <Part
        name="composition-header-title"
        data-composition-header-title=""
        className="min-w-0 text-center"
      >
        <p className="text-[9px] font-bold tracking-[0.18em] text-indigo-500 uppercase">
          {eyebrow}
        </p>
        <h2 className="truncate text-[17px] leading-tight font-bold tracking-[-0.02em]">{title}</h2>
      </Part>
      <span className="justify-self-end rounded-full bg-indigo-500/10 px-2 py-1 text-[9px] font-extrabold tracking-[0.12em] text-indigo-500">
        ROOT
      </span>
    </header>
  );
}

export default CompositionHeader;
