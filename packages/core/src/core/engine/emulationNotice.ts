import { detectBlinkEngine } from "@core/engine/driverPolicy";

// DevTools device-emulation notice.
//
// The device toolbar does not just resize the viewport: the page renders to
// an emulated surface that is then RESCALED into the DevTools panel — an
// extra compositing pass whose alignment with the physical pixel grid is
// generally fractional. Under it, perfectly clean motion grows artifacts a
// plain window never shows: moving text shimmers continuously (every frame
// resamples glyph AA through the fractional scale), and the engine's
// post-landing housekeeping (layer demotion, warm-up teardown — pixel-silent
// in a plain window, measured) becomes a visible one-frame re-raster flash.
// A multi-week jank hunt (docs/postmortem-2026-08-motion-jank.md) chased
// exactly these phantoms because every instrument reads the pre-scale
// surface and reports "clean" while the eye watches the post-scale one.
//
// So the engine says it out loud, once per session, the first time a
// transition runs under emulation. Detection: the device toolbar force-
// enables touch emulation, and no Mac has a touchscreen — Blink + a Mac
// platform + touch points is the toolbar's signature. (Windows touch
// laptops make the same signal ambiguous, so they are left alone.)

export const isLikelyDeviceEmulation = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform ?? "";
  if (!/Mac/i.test(platform)) return false;
  return (navigator.maxTouchPoints ?? 0) > 0;
};

let noticed = false;

/* v8 ignore next 3 -- test hook: the once-flag is module-global. */
export const resetEmulationNoticeForTesting = () => {
  noticed = false;
};

export const noticeDeviceEmulationOnce = () => {
  if (noticed) return;
  if (!detectBlinkEngine() || !isLikelyDeviceEmulation()) return;
  noticed = true;
  // eslint-disable-next-line no-console
  console.warn(
    "[flemo] DevTools device emulation detected. The emulated view is " +
      "composited through an extra scaling pass, so transitions can show " +
      "text shimmer and settle flashes that do NOT exist in a plain window " +
      "or on a real device. Judge motion quality outside device emulation."
  );
};
