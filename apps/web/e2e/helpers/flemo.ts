import { type Locator, type Page } from "@playwright/test";

// Every flemo screen carries these data attributes; `data-flemo-status` flips
// back to COMPLETED/IDLE when a transition's keyframe ends.
export function activeScreen(page: Page): Locator {
  return page.locator('[data-flemo-screen][data-flemo-active="true"]');
}

export function allScreens(page: Page): Locator {
  return page.locator("[data-flemo-screen]");
}

// The site header is the first <header> in the DOM; in-screen demos (wallet,
// music) render their own <header>s later, so scope to the first one.
export function siteHeader(page: Page): Locator {
  return page.locator("header").first();
}

// The header's nav buttons, scoped so they never collide with in-screen CTAs of
// the same label.
export function navButton(page: Page, label: string): Locator {
  return siteHeader(page).getByRole("button", { name: label, exact: true });
}

// Wait until no screen is mid-transition before the next tap: the engine
// ignores a push while a navigation is in flight, and the player honestly
// carries a flight past any fixed pause on a stalled CI runner (wall
// completion = authored span + stall excess, so a constant settle can't
// bound it). The trailing grace covers the COMPLETED commit that unlocks
// the task queue.
export async function waitForNavIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    for (const element of document.querySelectorAll("[data-flemo-screen]")) {
      const status = element.getAttribute("data-flemo-status") ?? "";
      if (status === "PUSHING" || status === "POPPING" || status === "REPLACING") return false;
    }
    return true;
  });
  await page.waitForTimeout(150);
}

// Browser-level network noise (favicon / manifest 404s) shows up as
// console.error but is not a JS bug. Filter it so we only catch real errors.
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
