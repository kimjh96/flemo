"use client";

import { useState } from "react";

import Icon from "@/components/Icon";

const MANAGERS = {
  npm: "npm i @flemo/react",
  pnpm: "pnpm add @flemo/react",
  bun: "bun add @flemo/react"
} as const;

type Manager = keyof typeof MANAGERS;

// The install line as a single control: pick the manager, copy the command.
function InstallCommand({ className }: { className?: string }) {
  const [manager, setManager] = useState<Manager>("npm");
  const [copied, setCopied] = useState(false);
  const command = MANAGERS[manager];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      className={`inline-flex h-11 max-w-full items-center rounded-lg border border-line bg-surface font-mono text-sm shadow-raised ${className ?? ""}`}
    >
      <div
        className="hidden h-full items-center border-r border-line px-1 sm:flex"
        role="radiogroup"
        aria-label="Package manager"
      >
        {(Object.keys(MANAGERS) as Manager[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={key === manager}
            onClick={() => setManager(key)}
            className={`h-7 rounded-sm px-2 text-xs whitespace-nowrap transition-colors ${
              key === manager ? "bg-surface-2 text-fg" : "text-fg-subtle hover:text-fg"
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      <span className="min-w-0 truncate px-3.5 text-fg">
        <span className="text-fg-subtle select-none">$ </span>
        {command}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy install command"}
        className="mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <Icon name={copied ? "check" : "copy"} size={15} className={copied ? "text-success" : ""} />
      </button>
    </div>
  );
}

export default InstallCommand;
