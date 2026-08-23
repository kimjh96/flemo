import { afterEach, describe, expect, it } from "vitest";

import { isLegacyAndroidBlink } from "@platform/engineProbes";

// WHAT THE GATE IS ALLOWED TO CONCLUDE FROM SILENCE.
//
// It selects an old BROWSER — the UA-CH brands list ships in Chromium 89 — and
// anything gated on it (the image decode offloader, the governed head kit) is
// measured against that population.
//
// It used to read the ABSENCE of the brands list as proof, and absence is not
// proof. `navigator.userAgentData` is exposed only in a SECURE CONTEXT, so a
// current Chrome reports exactly what a 2019 one does the moment the page is
// served over plain HTTP. Measured with one browser, one UA, two URLs:
//
//   http://127.0.0.1:5173     secure    userAgentData: object     -> modern
//   http://192.168.0.74:5173  insecure  userAgentData: undefined  -> "legacy"
//
// Device-reported on a Galaxy Z Flip 4 — a 2022 phone on a current Chrome —
// taking the legacy profile over a LAN test server. The same blindness applies
// wherever UA-CH is off: enterprise policy, privacy settings, a fork.

const NAV = navigator as { userAgentData?: unknown };

const setEnv = (ua: string, { brands, touch = 5 }: { brands?: boolean; touch?: number } = {}) => {
  if (brands) NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
  else delete NAV.userAgentData;
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch, configurable: true });
};

const MODERN =
  "Mozilla/5.0 (Linux; Android 13; SM-F721N) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile";
const ANCIENT =
  "Mozilla/5.0 (Linux; Android 9; SM-N960N) AppleWebKit/537.36 Chrome/79.0.3945.116 Mobile";

afterEach(() => {
  delete NAV.userAgentData;
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
});

describe("the legacy Android Blink gate", () => {
  it("does not call a current Chrome legacy just because UA-CH is missing", () => {
    // The Flip 4 over plain HTTP: no brands list, but the UA says Chrome 120.
    setEnv(MODERN);
    expect(isLegacyAndroidBlink()).toBe(false);
  });

  it("still catches a browser that is actually old", () => {
    setEnv(ANCIENT);
    expect(isLegacyAndroidBlink()).toBe(true);
  });

  it("takes the brands list as the answer when it is there", () => {
    setEnv(ANCIENT, { brands: true });
    expect(isLegacyAndroidBlink()).toBe(false);
  });

  it("reads the boundary where UA-CH shipped", () => {
    setEnv(MODERN.replace("Chrome/120.0.0.0", "Chrome/89"));
    expect(isLegacyAndroidBlink()).toBe(true);
    setEnv(MODERN.replace("Chrome/120.0.0.0", "Chrome/90"));
    expect(isLegacyAndroidBlink()).toBe(false);
  });

  it("treats a UA with no Chromium version at all as old", () => {
    // Too old to name itself is old enough.
    setEnv("Mozilla/5.0 (Linux; Android 4.4; GT-I9300) AppleWebKit/534.30 Mobile Safari/534.30");
    expect(isLegacyAndroidBlink()).toBe(true);
  });

  it("never reaches Android-less, Firefox or non-touch sessions", () => {
    setEnv("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/79");
    expect(isLegacyAndroidBlink()).toBe(false);
    setEnv("Mozilla/5.0 (Android 9; Mobile; rv:68.0) Gecko/68.0 Firefox/68.0");
    expect(isLegacyAndroidBlink()).toBe(false);
    setEnv(ANCIENT, { touch: 0 });
    expect(isLegacyAndroidBlink()).toBe(false);
  });
});
