import { expect, type Locator, type Page } from "@playwright/test";

// Wait for the active screen scope to settle at a rest status (`COMPLETED`
// or `IDLE`). Every flemo transition flips status back to one of these
// when the keyframe ends, so it's the canonical "transition is done"
// signal — no time-based sleep.
export async function waitForTransitionSettled(page: Page) {
  await expect(page.locator('[data-flemo-screen][data-flemo-active="true"]')).toHaveAttribute(
    "data-flemo-status",
    /COMPLETED|IDLE/
  );
}

export function activeScreen(page: Page): Locator {
  return page.locator('[data-flemo-screen][data-flemo-active="true"]');
}

export function allScreens(page: Page): Locator {
  return page.locator("[data-flemo-screen]");
}

export function albumTile(page: Page, nth = 0): Locator {
  return page.locator("button:has(.aspect-square)").nth(nth);
}

// Browser-level network noise (404 favicon / manifest / sourcemap fetches)
// surfaces through `console.error` but isn't a JS bug worth failing tests
// over. Filter on the canonical Chromium message so we keep real errors.
const NETWORK_NOISE = /^Failed to load resource: the server responded with a status/;

export function trackConsoleErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (NETWORK_NOISE.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return { errors };
}
