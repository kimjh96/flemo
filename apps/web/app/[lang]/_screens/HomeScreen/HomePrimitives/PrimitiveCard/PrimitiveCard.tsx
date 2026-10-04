import type { ReactNode } from "react";

import Icon, { type IconName } from "@/components/Icon";

export interface PrimitiveCardProps {
  icon: IconName;
  title: string;
  body: string;
  // The live stage under the copy. Omitted for text-only cards.
  stage?: ReactNode;
  // A strip at the top of the stage: a switcher, or what to try.
  controls?: ReactNode;
  // Opens the page that explains this piece.
  onOpen?: () => void;
  className?: string;
}

// One cell of the building-blocks grid: copy on top, a live stage below on the
// instrument grid. Every stage is a real nested Router. The copy block has a
// fixed floor so the stages of a row line up whatever the copy's length.
function PrimitiveCard({
  icon,
  title,
  body,
  stage,
  controls,
  onOpen,
  className
}: PrimitiveCardProps) {
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border border-line bg-surface ${className ?? ""}`}
    >
      <div className={`flex flex-col gap-2 p-6 ${stage ? "min-h-[188px]" : ""}`}>
        <div className="flex items-center justify-between">
          <span className="grid size-8 place-items-center rounded-md border border-line bg-bg-subtle text-fg">
            <Icon name={icon} size={16} />
          </span>
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              aria-label={title}
              className="grid size-8 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <Icon name="arrowUpRight" size={16} />
            </button>
          )}
        </div>
        <h3 className="mt-3 text-h3 text-fg">{title}</h3>
        <p className="text-sm text-fg-muted">{body}</p>
      </div>
      {stage && (
        <div className="bg-grid relative mt-auto flex flex-col items-center gap-5 border-t border-line bg-bg-subtle px-4 pt-5 pb-7">
          <div className="flex h-8 items-center">{controls}</div>
          {stage}
        </div>
      )}
    </article>
  );
}

export default PrimitiveCard;
