"use client";

import { useEffect } from "react";

import { useHistoryStore, useNavigateStore, usePathname } from "@flemo/react";

import { useTelemetry } from "../../_providers/TelemetryContext";

export interface StackReporterProps {
  /** Which scope this is reading. There can be two on screen at once. */
  scope: string;
}

// A headless <Part>-less publisher: it renders nothing and mounts INSIDE the
// Router whose state it reports.
//
// It has to mount inside. `usePathname`, `useNavigateStore` and
// `useHistoryStore` all read the nearest Router's stores, so a reader placed
// outside would report the shell's navigation rather than the fixture's — and
// the nested case, where an inner stack deepens while the outer one holds
// still, is precisely the thing worth watching.
//
// What it does NOT do is draw. See `TelemetryContext` for why the row lives
// under the stage frame instead of inside the phone.
function StackReporter({ scope }: StackReporterProps) {
  const { report } = useTelemetry();
  const path = usePathname();
  const status = useNavigateStore((state) => state.status);
  const depth = useHistoryStore((state) => state.histories.length);
  const index = useHistoryStore((state) => state.index);

  useEffect(() => {
    report(scope, { path, status, index, depth });
    // Unmounting clears the row rather than freezing it: switching cases tears
    // this Router down, and a stale depth left under the frame would be read as
    // the new case's.
    return () => report(scope, null);
  }, [report, scope, path, status, index, depth]);

  return null;
}

export default StackReporter;
