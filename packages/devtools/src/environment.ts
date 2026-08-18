import type { EnvironmentFingerprint, UaBrand } from "./types";

// Environment fingerprinting + observation-trap detection.
//
// The fingerprint answers the questions an agent otherwise has to round-trip
// through the user: which engine, real device or emulation, display cadence,
// touch or pointer, zoomed or not. Every read is guarded — a fingerprint must
// never throw in any embedding.

const readBrands = (): UaBrand[] | null => {
  if (typeof navigator === "undefined") return null;
  const data = (
    navigator as {
      userAgentData?: { brands?: ReadonlyArray<{ brand?: string; version?: string }> };
    }
  ).userAgentData;
  if (!data || !Array.isArray(data.brands)) return null;
  return data.brands.map((entry) => ({
    brand: String(entry.brand ?? ""),
    version: String(entry.version ?? "")
  }));
};

/**
 * Engine classification. Chromium brand in UA-CH is the only reliable Blink
 * signal (mere presence of userAgentData is not — WebKit shipped it in 2025).
 * iOS Chrome is WebKit underneath and ships no Chromium brand, so it
 * correctly lands in "webkit".
 */
export const detectEngine = (): "blink" | "webkit" | "gecko" | "unknown" => {
  if (typeof navigator === "undefined") return "unknown";
  const brands = readBrands();
  if (brands?.some((entry) => /Chromium/i.test(entry.brand))) return "blink";
  const ua = navigator.userAgent ?? "";
  if (/Firefox|FxiOS/i.test(ua)) return "gecko";
  if (brands) return "webkit"; // UA-CH present but no Chromium brand
  if (/AppleWebKit/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua)) return "webkit";
  if (/Android/i.test(ua)) return "blink"; // legacy Android Blink ships no UA-CH
  return "unknown";
};

/**
 * DevTools device-emulation signature: the device toolbar force-enables touch
 * emulation, so Blink + a DESKTOP platform + touch points is its fingerprint.
 * Duplicated from packages/core/src/core/engine/emulationNotice.ts (a zero-
 * dependency package cannot import it); core's console notice restricts
 * itself to Mac, where the signal is unambiguous — here Win/Linux are also
 * flagged as SUSPECTED because the report carries the platform string, so an
 * agent can weigh the Windows-touch-laptop ambiguity itself.
 */
export const isEmulationSuspected = (): boolean => {
  if (typeof navigator === "undefined") return false;
  if (detectEngine() !== "blink") return false;
  const platform = navigator.platform ?? "";
  if (!/Mac|Win|Linux/i.test(platform)) return false;
  if (/Android/i.test(navigator.userAgent ?? "") && !/Mac|Win/i.test(platform)) {
    // "Linux armv8l" etc. on a real Android device is not emulation.
    return /Linux (x86_64|i686)/i.test(platform);
  }
  return (navigator.maxTouchPoints ?? 0) > 0;
};

/**
 * Sample the idle rAF cadence: median gap over ~`frames` frames. Run at
 * attach, while the page is quiet, so the report can distinguish a 60Hz
 * display from 120Hz ProMotion or an LPM-capped ~30Hz clock.
 */
export const sampleRafCadence = (
  frames = 20
): Promise<{ medianGapMs: number | null; sampleCount: number }> =>
  new Promise((resolveCadence) => {
    // Public API: clamp the sample count, or `frames <= 0` resolves the
    // median off an empty window (undefined → NaN → serialized as null).
    const target = Number.isFinite(frames) ? Math.max(1, Math.floor(frames)) : 20;
    if (typeof requestAnimationFrame !== "function" || typeof performance === "undefined") {
      resolveCadence({ medianGapMs: null, sampleCount: 0 });
      return;
    }
    const gaps: number[] = [];
    let last: number | null = null;
    const step = () => {
      const now = performance.now();
      if (last !== null) gaps.push(now - last);
      last = now;
      if (gaps.length >= target) {
        const sorted = [...gaps].sort((left, right) => left - right);
        const median = sorted[Math.floor(sorted.length / 2)];
        resolveCadence({
          medianGapMs: Math.round(median * 100) / 100,
          sampleCount: gaps.length
        });
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

const longTaskObservable = (): boolean => {
  try {
    return (
      typeof PerformanceObserver !== "undefined" &&
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes("longtask")
    );
  } catch {
    return false;
  }
};

export const captureEnvironment = (rafCadence: {
  medianGapMs: number | null;
  sampleCount: number;
}): EnvironmentFingerprint => {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const win = typeof window !== "undefined" ? window : null;
  let reducedMotion = false;
  try {
    reducedMotion = win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    reducedMotion = false;
  }
  return {
    userAgent: nav?.userAgent ?? "",
    uaBrands: readBrands(),
    engine: detectEngine(),
    platform: nav?.platform ?? "",
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    devicePixelRatio: win?.devicePixelRatio ?? 1,
    screen: {
      width: win?.screen?.width ?? 0,
      height: win?.screen?.height ?? 0
    },
    viewport: {
      width: win?.innerWidth ?? 0,
      height: win?.innerHeight ?? 0
    },
    visualViewportScale: win?.visualViewport?.scale ?? null,
    rafCadence,
    reducedMotion,
    emulationSuspected: isEmulationSuspected(),
    observation: {
      longTasks: longTaskObservable(),
      elementAnimations:
        typeof Element !== "undefined" &&
        typeof (Element.prototype as { getAnimations?: unknown }).getAnimations === "function",
      playerGapMirror: Array.isArray(
        (win as unknown as { __flemoPlayerGaps?: unknown } | null)?.__flemoPlayerGaps
      )
    }
  };
};
