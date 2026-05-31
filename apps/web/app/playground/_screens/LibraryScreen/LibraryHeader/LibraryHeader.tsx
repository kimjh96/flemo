"use client";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";

import LibrarySegmentBar from "../LibrarySegmentBar";

import type { Segment } from "../LibraryScreen.types";

export interface LibraryHeaderProps {
  segment: Segment;
  onChange: (next: Segment) => void;
}

function LibraryHeader({ segment, onChange }: LibraryHeaderProps) {
  const dict = usePlaygroundDict();
  return (
    <div className="flex flex-col gap-3 bg-[var(--color-surface)] px-5 pb-3 pt-4">
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--color-text-primary)]">
        {dict.library.title}
      </h1>
      <LibrarySegmentBar value={segment} onChange={onChange} />
    </div>
  );
}

export default LibraryHeader;
