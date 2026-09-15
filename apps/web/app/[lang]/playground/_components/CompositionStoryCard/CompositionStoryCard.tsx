"use client";

import { Morph, Part } from "@flemo/react";

import CardTitle from "../CardTitle";

export interface CompositionStoryCardProps {
  paired: boolean;
  variant: "preview" | "detail";
}

const SHELL_ID = "composition-featured";
const TITLE_ID = "composition-featured-title";

function CompositionStoryCard({ paired, variant }: CompositionStoryCardProps) {
  const detail = variant === "detail";
  const className = detail
    ? "relative block min-h-[270px] overflow-hidden rounded-[30px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-5 text-white shadow-2xl shadow-violet-500/20"
    : "relative block min-h-[142px] overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-4 text-white shadow-xl shadow-violet-500/20";

  const content = (
    <>
      <Part name="composition-card-copy">
        <p className="text-[9px] font-bold tracking-[0.2em] text-white/70 uppercase">
          {detail ? "Message 42" : "Today"}
        </p>
      </Part>
      <div className={detail ? "mt-24" : "mt-8"}>
        <div className={detail ? "h-10" : "h-7"}>
          <CardTitle
            layoutId={paired ? TITLE_ID : null}
            className={
              detail
                ? "block truncate text-[30px] leading-10 font-black tracking-[-0.04em] text-white"
                : "block truncate text-xl leading-7 font-black tracking-[-0.03em] text-white"
            }
          >
            Morning brief
          </CardTitle>
        </div>
        <Part name="composition-card-copy">
          <p
            className={detail ? "mt-2 text-[13px] text-white/75" : "mt-1 text-[11px] text-white/75"}
          >
            {detail
              ? "One story, continued from the workspace card."
              : "Open the story without leaving the app shell."}
          </p>
        </Part>
      </div>
    </>
  );

  if (!paired) return <div className={className}>{content}</div>;

  return (
    <Morph name="composition-card-shell" layoutId={SHELL_ID} className={className}>
      {content}
    </Morph>
  );
}

export default CompositionStoryCard;
