"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import { curvePath, type TransitionSpec } from "./TransitionReadout.utils";

type Phase = "idle" | "push" | "pop" | "swipe";

export interface TransitionReadoutProps {
  // The element hosting the Router to watch (the device glass).
  hostRef: RefObject<HTMLElement | null>;
  // The transition that carries the push, by name and by clock.
  name: string;
  spec: TransitionSpec | null;
  className?: string;
}

const W = 120;
const H = 36;

// An instrument strip under a live demo: what the stack is doing, which
// transition carries it, for how long, and on what curve, with a dot tracing
// the curve in real time.
//
// IT COSTS THE TRANSITION NOTHING. It never samples animations per frame (a page
// sampler measurably delays landings). It listens for the status attribute the
// engine already writes at a transition's start and end, and the dot is a CSS
// animation of its own: x runs linearly on the transition's clock while y runs on
// the transition's curve, so together they trace the curve on the compositor.
function TransitionReadout({ hostRef, name, spec, className }: TransitionReadoutProps) {
  const t = useShellDict().readout;
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState(0);
  const pointerDown = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let current: Phase = "idle";
    const read = () => {
      let next: Phase = "idle";
      for (const screen of host.querySelectorAll("[data-flemo-screen][data-flemo-status]")) {
        const status = screen.getAttribute("data-flemo-status");
        if (status === "PUSHING" || status === "REPLACING") next = "push";
        else if (status === "POPPING") next = pointerDown.current ? "swipe" : "pop";
      }
      if (next !== current) {
        current = next;
        setPhase(next);
        if (next === "push" || next === "pop") setRun((value) => value + 1);
      }
    };

    const observer = new MutationObserver(read);
    observer.observe(host, {
      attributes: true,
      attributeFilter: ["data-flemo-status"],
      subtree: true
    });
    const down = () => {
      pointerDown.current = true;
    };
    const up = () => {
      pointerDown.current = false;
    };
    host.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      observer.disconnect();
      host.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [hostRef]);

  const clock = phase === "pop" ? spec?.pop : spec?.push;
  const moving = phase !== "idle";
  const label = { idle: t.idle, push: t.push, pop: t.pop, swipe: t.swipe }[phase];

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-5 rounded-lg border border-line bg-surface/80 px-3.5 py-2.5 backdrop-blur ${className ?? ""}`}
    >
      <div className="flex min-w-[88px] flex-col gap-1">
        <span className="label flex items-center gap-1.5 text-fg-subtle">
          <span
            className={`size-1.5 rounded-full ${moving ? "bg-accent" : "bg-fg-subtle/50"}`}
            style={moving ? { animation: "signal-pulse 0.8s ease-in-out infinite" } : undefined}
          />
          {label}
        </span>
        <span className="font-mono text-sm text-fg">{name}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <span className="label text-fg-subtle">{t.duration}</span>
        <span className="font-mono text-sm text-fg tabular-nums">
          {clock ? `${Math.round(clock.duration * 1000)}ms` : "0ms"}
        </span>
      </div>

      <div className="relative" style={{ width: W, height: H }} aria-label={t.curve}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="overflow-visible"
          aria-hidden="true"
        >
          <line x1="0" y1={H} x2={W} y2={H} stroke="var(--line-strong)" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2={H} stroke="var(--line-strong)" strokeWidth="1" />
          {clock && (
            <path
              d={curvePath(clock.ease, W, H)}
              fill="none"
              stroke="var(--fg-subtle)"
              strokeWidth="1.25"
            />
          )}
        </svg>
        {clock && (phase === "push" || phase === "pop") && clock.duration > 0 && (
          <div
            key={run}
            aria-hidden="true"
            className="absolute bottom-0 left-0"
            style={{ animation: `readout-x ${clock.duration}s linear both` }}
          >
            <div
              className="-mb-1 -ml-1 size-2 rounded-full bg-accent shadow-[0_0_0_3px_var(--accent-soft)]"
              style={{
                animation: `readout-y ${clock.duration}s cubic-bezier(${clock.ease.join(",")}) both`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default TransitionReadout;
