import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isLikelyDeviceEmulation,
  noticeDeviceEmulationOnce,
  resetEmulationNoticeForTesting
} from "@core/engine/emulationNotice";

// The device-emulation notice (emulationNotice.ts): Blink + Mac platform +
// touch points = the DevTools device toolbar's signature (no Mac has a
// touchscreen); the engine warns once per session so motion is never judged
// through the emulated view's extra scaling pass unknowingly.

const stubNavigator = (overrides: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(overrides)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
};

describe("emulationNotice", () => {
  beforeEach(() => {
    resetEmulationNoticeForTesting();
  });

  afterEach(() => {
    stubNavigator({ maxTouchPoints: 0 });
    delete (navigator as { userAgentData?: unknown }).userAgentData;
    vi.restoreAllMocks();
  });

  it("touch points on a Mac read as the device toolbar", () => {
    stubNavigator({ platform: "MacIntel", maxTouchPoints: 5 });
    expect(isLikelyDeviceEmulation()).toBe(true);
  });

  it("a plain Mac (no touch) and touch-capable Windows stay silent", () => {
    stubNavigator({ platform: "MacIntel", maxTouchPoints: 0 });
    expect(isLikelyDeviceEmulation()).toBe(false);
    stubNavigator({ platform: "Win32", maxTouchPoints: 10 });
    expect(isLikelyDeviceEmulation()).toBe(false);
  });

  it("warns exactly once per session, on Blink only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubNavigator({ platform: "MacIntel", maxTouchPoints: 5 });

    // Non-Blink (no userAgentData): silent.
    noticeDeviceEmulationOnce();
    expect(warn).not.toHaveBeenCalled();

    stubNavigator({ userAgentData: {} });
    noticeDeviceEmulationOnce();
    noticeDeviceEmulationOnce();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("device emulation");
  });
});
