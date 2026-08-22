import { describe, expect, it, vi } from "vitest";

import {
  detectBlinkEngine,
  isDesktopBlink,
  isDesktopMacWebKit,
  isLegacyAndroidBlink
} from "@platform/engineProbes";

// Pure navigator reads (engineProbes.ts). The driver policy that used to live
// beside them — the demotion ledger, its probation probe and the force pin —
// went with the rAF player; what remains is the set of engine predicates the
// routing and the per-platform defaults key on.

describe("detectBlinkEngine", () => {
  it("reads a Chromium brand as the Blink signal, not mere userAgentData presence", () => {
    expect(detectBlinkEngine()).toBe(false); // jsdom ships none
    // WebKit shipped userAgentData with no Chromium brand → still non-Blink.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Safari", version: "18" }] },
      configurable: true
    });
    expect(detectBlinkEngine()).toBe(false);
    // Empty/absent brands → non-Blink.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [] },
      configurable: true
    });
    expect(detectBlinkEngine()).toBe(false);
    // A Chromium brand → Blink.
    Object.defineProperty(navigator, "userAgentData", {
      value: { brands: [{ brand: "Chromium", version: "120" }, { brand: "Not?A_Brand" }] },
      configurable: true
    });
    expect(detectBlinkEngine()).toBe(true);
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  });
});

describe("isDesktopMacWebKit", () => {
  const stub = (over: { platform?: string; touch?: number; blink?: boolean }) => {
    Object.defineProperty(navigator, "platform", {
      value: over.platform ?? "",
      configurable: true
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: over.touch ?? 0,
      configurable: true
    });
    if (over.blink) {
      Object.defineProperty(navigator, "userAgentData", {
        value: { brands: [{ brand: "Chromium", version: "120" }] },
        configurable: true
      });
    } else {
      delete (navigator as { userAgentData?: unknown }).userAgentData;
    }
  };

  const restore = () => {
    Reflect.deleteProperty(navigator, "platform");
    Reflect.deleteProperty(navigator, "maxTouchPoints");
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  };

  it("is true for a non-touch Mac WebKit session (desktop Safari)", () => {
    stub({ platform: "MacIntel" });
    try {
      expect(isDesktopMacWebKit()).toBe(true);
    } finally {
      restore();
    }
  });

  it("is false for an iPad spoofing a Mac platform (touch keeps the player)", () => {
    stub({ platform: "MacIntel", touch: 5 });
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false for desktop Blink on a Mac", () => {
    stub({ platform: "MacIntel", blink: true });
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false where the platform is empty (jsdom, and any non-Mac desktop)", () => {
    stub({ platform: "" });
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false where the environment reports no touch count at all", () => {
    // Not a verified non-touch Mac: fall through to the player rather than
    // default an unknown environment onto the compiled tier.
    stub({ platform: "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { value: undefined, configurable: true });
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false without a navigator (SSR)", () => {
    vi.stubGlobal("navigator", undefined);
    try {
      expect(isDesktopMacWebKit()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// The DESKTOP-BLINK profile: what Blink does with an occluded layer, and what a
// desktop can spend on memory. Neither reads the display, which is why these
// defaults no longer hang off the steady-60 refresh-rate verdict.
describe("isDesktopBlink", () => {
  const stub = (over: { blink?: boolean; touch?: number }) => {
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: over.touch ?? 0,
      configurable: true
    });
    if (over.blink) {
      Object.defineProperty(navigator, "userAgentData", {
        value: { brands: [{ brand: "Chromium", version: "120" }] },
        configurable: true
      });
    } else {
      delete (navigator as { userAgentData?: unknown }).userAgentData;
    }
  };
  const restore = () => {
    Reflect.deleteProperty(navigator, "maxTouchPoints");
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  };

  it("is true for desktop Chromium", () => {
    stub({ blink: true });
    try {
      expect(isDesktopBlink()).toBe(true);
    } finally {
      restore();
    }
  });

  it("is false for touch Chromium", () => {
    stub({ blink: true, touch: 5 });
    try {
      expect(isDesktopBlink()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false for WebKit, touch or not", () => {
    stub({ blink: false });
    try {
      expect(isDesktopBlink()).toBe(false);
      stub({ blink: false, touch: 5 });
      expect(isDesktopBlink()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false where the environment reports no touch count at all", () => {
    // Same reading isDesktopMacWebKit uses: unknown is not a verified desktop.
    stub({ blink: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: undefined, configurable: true });
    try {
      expect(isDesktopBlink()).toBe(false);
    } finally {
      restore();
    }
  });

  it("is false without a navigator (SSR)", () => {
    vi.stubGlobal("navigator", undefined);
    try {
      expect(isDesktopBlink()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// The legacy-Android-Blink probe: a touch Chromium that ships NO UA-CH brands
// list. It selects the governed head kit from flight one, so a modern device
// (brands present) must never match it and iOS must never match it at all.
describe("isLegacyAndroidBlink", () => {
  const withNavigator = (patch: Record<string, unknown>, run: () => void) => {
    const saved: [string, PropertyDescriptor | undefined][] = Object.keys(patch).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(navigator, key)
    ]);
    for (const [key, value] of Object.entries(patch)) {
      Object.defineProperty(navigator, key, { value, configurable: true });
    }
    try {
      run();
    } finally {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(navigator, key, descriptor);
        else delete (navigator as unknown as Record<string, unknown>)[key];
      }
    }
  };

  it("is true for a touch Android browser with no UA-CH brands", () => {
    withNavigator(
      { userAgent: "Mozilla/5.0 (Linux; Android 10) SamsungBrowser/12", maxTouchPoints: 5 },
      () => expect(isLegacyAndroidBlink()).toBe(true)
    );
  });

  it("is false once UA-CH brands are present (a modern device)", () => {
    withNavigator(
      {
        userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120",
        maxTouchPoints: 5,
        userAgentData: { brands: [{ brand: "Chromium", version: "120" }] }
      },
      () => expect(isLegacyAndroidBlink()).toBe(false)
    );
  });

  it("is false for Android Firefox and for a non-touch Android", () => {
    withNavigator(
      { userAgent: "Mozilla/5.0 (Android 13; Mobile) Firefox/130", maxTouchPoints: 5 },
      () => expect(isLegacyAndroidBlink()).toBe(false)
    );
    withNavigator(
      { userAgent: "Mozilla/5.0 (Linux; Android 10) SamsungBrowser/12", maxTouchPoints: 0 },
      () => expect(isLegacyAndroidBlink()).toBe(false)
    );
  });

  it("is false for iOS (no Android token) and without a navigator", () => {
    withNavigator(
      { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari", maxTouchPoints: 5 },
      () => expect(isLegacyAndroidBlink()).toBe(false)
    );
    const saved = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
    try {
      expect(isLegacyAndroidBlink()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: saved, configurable: true });
    }
  });
});

// Malformed-navigator paths. These probes run on whatever a page's embedder
// hands them — a WebView, a spoofing extension, a headless harness — and a
// missing field must read as "not this platform" rather than throw inside a
// transition.
describe("the probes under a malformed navigator", () => {
  const withNavigator = (patch: Record<string, unknown>, run: () => void) => {
    const saved: [string, PropertyDescriptor | undefined][] = Object.keys(patch).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(navigator, key)
    ]);
    for (const [key, value] of Object.entries(patch)) {
      Object.defineProperty(navigator, key, { value, configurable: true });
    }
    try {
      run();
    } finally {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(navigator, key, descriptor);
        else delete (navigator as unknown as Record<string, unknown>)[key];
      }
    }
  };

  it("reads a brands entry with no brand string as non-Chromium", () => {
    withNavigator({ userAgentData: { brands: [{ version: "120" }, {}] } }, () => {
      expect(detectBlinkEngine()).toBe(false);
    });
  });

  it("treats an absent userAgent as no signal, on both UA-fallback probes", () => {
    withNavigator({ userAgent: undefined, maxTouchPoints: 5 }, () => {
      expect(detectBlinkEngine()).toBe(false);
      expect(isLegacyAndroidBlink()).toBe(false);
    });
  });

  it("treats an absent touch count as no touch surface", () => {
    withNavigator(
      {
        userAgent: "Mozilla/5.0 (Linux; Android 10) SamsungBrowser/12",
        maxTouchPoints: undefined
      },
      () => {
        // The UA says legacy Android Chromium, but nothing confirms a touch
        // surface — the governed head kit must not arm on a guess.
        expect(isLegacyAndroidBlink()).toBe(false);
      }
    );
  });
});
