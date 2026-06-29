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
