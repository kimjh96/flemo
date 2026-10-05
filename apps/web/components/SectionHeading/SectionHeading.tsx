import type { ReactNode } from "react";

export interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

// The heading every landing section opens with: a mono eyebrow with the signal
// tick, the title, and at most one sentence under it.
function SectionHeading({ eyebrow, title, body, align = "left", className }: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={`flex flex-col gap-3 ${centered ? "items-center text-center" : ""} ${className ?? ""}`}
    >
      <span className="label flex items-center gap-2 text-fg-subtle">
        <span aria-hidden="true" className="h-px w-4 bg-accent" />
        {eyebrow}
      </span>
      <h2 className="max-w-[22ch] text-h1 text-fg">{title}</h2>
      {body && <p className="max-w-[56ch] text-lead text-fg-muted">{body}</p>}
    </div>
  );
}

export default SectionHeading;
