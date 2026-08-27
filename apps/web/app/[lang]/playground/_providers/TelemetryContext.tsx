"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// THE STACK READOUT, moved out of the phone.
//
// The old one rendered this strip INSIDE the simulated device, once per Router,
// so a phone frame ended up with a debug bar above its tab bar and another
// below it, and the app's own content was clipped by them. A visitor cannot
// judge whether a transition looks native inside a device that has developer
// telemetry welded to its chassis.
//
// So the reading is published from inside and drawn outside. The publisher
// still mounts within its Router and still reads the same public hooks
// (`usePathname`, `useNavigateStore`, `useHistoryStore`) — the data has not
// become less real, it has only stopped being furniture. Two scopes can report
// at once, which is what makes "nested" a thing you watch rather than read: the
// outer stack holds still at 1/1 while the inner one deepens.
//
// This is NOT @flemo/devtools and must not become it. That package is a
// diagnostic loaded on demand by a developer; this is one row a visitor reads
// while pressing things. Different surfaces, and the site does not depend on
// the package.
export interface Reading {
  path: string;
  status: string;
  index: number;
  depth: number;
}

interface Telemetry {
  readings: Record<string, Reading>;
  report: (scope: string, reading: Reading | null) => void;
}

const TelemetryContext = createContext<Telemetry | null>(null);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [readings, setReadings] = useState<Record<string, Reading>>({});

  const report = useCallback((scope: string, reading: Reading | null) => {
    setReadings((current) => {
      const previous = current[scope];

      // A scope that unmounts takes its row with it, so a case switch does not
      // leave a stale stack depth under the frame reporting on a Router that
      // is no longer there.
      if (!reading) {
        if (!previous) return current;
        const next = { ...current };
        delete next[scope];
        return next;
      }

      // Bail on an unchanged reading. The publisher re-reports whenever its
      // Router's stores tick, and a new object every time would re-render the
      // row on frames where nothing it displays actually moved.
      if (
        previous &&
        previous.path === reading.path &&
        previous.status === reading.status &&
        previous.index === reading.index &&
        previous.depth === reading.depth
      ) {
        return current;
      }

      return { ...current, [scope]: reading };
    });
  }, []);

  const value = useMemo(() => ({ readings, report }), [readings, report]);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry(): Telemetry {
  const value = useContext(TelemetryContext);
  if (!value) throw new Error("useTelemetry must be used inside a TelemetryProvider");
  return value;
}

export default TelemetryContext;
