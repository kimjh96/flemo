import { expect, test } from "@playwright/test";

import { navButton, siteHeader } from "./helpers/flemo";

test.describe("shell ux", () => {
  // A composed deep link (sub-page) keeps its section menu highlighted via the
  // prefix match. Desktop only, since the header nav is hidden on mobile.
  test("a deep link keeps the section menu active", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 768, "desktop header nav only");

    await page.goto("/docs/router");
    await expect(navButton(page, "Docs")).toHaveAttribute("aria-current", "page");

    await page.goto("/playground/3");
    await expect(navButton(page, "Playground")).toHaveAttribute("aria-current", "page");
  });

  // The toggle keeps the language in localStorage, so a refresh stays in it even
  // though the shell strips the locale from the URL.
  test("the language choice survives a reload", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Introduction", level: 1 })).toBeVisible();

    await siteHeader(page).getByRole("button", { name: "한국어" }).click();
    await expect(page.getByRole("heading", { name: "소개", level: 1 })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "소개", level: 1 })).toBeVisible();
  });

  // The 404 localizes by the URL prefix, not just the cookie/browser language —
  // a fresh context (no NEXT_LOCALE cookie) on /ko still gets Korean.
  test("a 404 localizes by URL prefix", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    await page.goto("/ko/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: "찾는 페이지가 없어요" })).toBeVisible();
  });

  // The home hero CTA navigates through flemo (a client transition), not a
  // next/link that would fight the shell Router.
  test("the home Get started CTA navigates to docs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get started", exact: true }).click();
    await expect(page).toHaveURL(/\/docs(\/|$)/);
  });

  // Mobile has no inline nav; the hamburger opens a menu that navigates.
  test("the mobile menu opens and navigates", async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width >= 768, "mobile menu only");

    await page.goto("/");
    const menu = siteHeader(page).getByRole("button", { name: "Menu" });
    await expect(menu).toBeVisible();

    await menu.click();
    await siteHeader(page).getByRole("button", { name: "Showcase", exact: true }).click();
    await expect(page).toHaveURL(/\/showcase$/);
  });
});
