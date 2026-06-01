"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface HomeNavLink {
  text: string;
  href: string;
  external?: boolean;
}

export interface HomeNavMenuProps {
  links: HomeNavLink[];
}

export default function HomeNavMenu({ links }: HomeNavMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleToggle = () => setOpen((prev) => !prev);
  const handleClose = () => setOpen(false);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={handleToggle}
        className="inline-flex size-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text-primary)]"
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <>
              <line x1={5} y1={5} x2={19} y2={19} />
              <line x1={19} y1={5} x2={5} y2={19} />
            </>
          ) : (
            <>
              <line x1={3} y1={7} x2={21} y2={7} />
              <line x1={3} y1={12} x2={21} y2={12} />
              <line x1={3} y1={17} x2={21} y2={17} />
            </>
          )}
        </svg>
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={handleClose}
            className="fixed inset-0 z-40 cursor-default"
          />
          <nav className="absolute right-0 top-full z-50 mt-2 flex min-w-44 flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noreferrer" : undefined}
                onClick={handleClose}
                className="rounded-xl px-3 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text-primary)]"
              >
                {link.text}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  );
}
