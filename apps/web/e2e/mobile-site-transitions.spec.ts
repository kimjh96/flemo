import { expect, test, type Page } from "@playwright/test";

// ON A PHONE THE SITE MOVES LIKE A SITE.
//
// The home calls to action and every move between doc pages used to push with
// cupertino on a phone, an app screen's push on a web page. The calls to action
// now shove the page as they do on a wide screen (site-drill), and doc pages
// turn (doc-forward / doc-backward) whether the page list, the search or a link
// in the page asked. The docs page list opens and closes with motion, and a
// live demo's moving Morph never paints over the page list laid on top of it.

test.skip(({ isMobile }) => !isMobile, "phone-only paths");

// The site's own screens: the shell's and the docs Router's. The live demos on
// a page are Routers too, and they autoplay, so they are never all idle and
// their screens are not the ones under test.
const SITE_SCREENS = `
  const siteScreens = () =>
    [...document.querySelectorAll("[data-flemo-screen]")].filter(
      (screen) =>
        !screen.parentElement?.closest("[data-flemo-screen]") ||
        screen.querySelector(":scope [data-testid='docs-scroll']")
    );
`;

// Wait until neither the shell nor the docs Router is mid-transition.
const waitForNavIdle = async (page: Page) => {
  await page.waitForFunction(
    `(() => { ${SITE_SCREENS} return siteScreens().every((screen) =>
      !["PUSHING", "POPPING", "REPLACING"].includes(screen.getAttribute("data-flemo-status") ?? "")); })()`
  );
  await page.waitForTimeout(150);
};

// The transition the shell's active screen arrived with.
const shellTransition = (page: Page) =>
  page.evaluate(() => {
    for (const screen of document.querySelectorAll("[data-flemo-screen]")) {
      if (screen.parentElement?.closest("[data-flemo-screen]")) continue;
      if (screen.getAttribute("data-flemo-active") === "true") {
        return screen.getAttribute("data-flemo-transition");
      }
    }
    return null;
  });

// The transition the docs Router's active page arrived with.
const docTransition = (page: Page) =>
  page.evaluate(() => {
    const scrolls = document.querySelectorAll<HTMLElement>('[data-testid="docs-scroll"]');
    for (const scroll of scrolls) {
      const screen = scroll.closest("[data-flemo-screen]");
      if (screen?.getAttribute("data-flemo-active") === "true") {
        return screen.getAttribute("data-flemo-transition");
      }
    }
    return null;
  });

const sheet = (page: Page) => page.getByTestId("docs-nav-sheet");

const sheetAnimations = (page: Page) =>
  page.evaluate(() =>
    (document.querySelector('[data-testid="docs-nav-sheet"]')?.getAnimations() ?? []).map(
      (animation) => (animation as CSSAnimation).animationName
    )
  );

test("the home calls to action shove the page instead of pushing with cupertino", async ({
  page
}) => {
  await page.goto("/");
  await waitForNavIdle(page);
  await page.getByRole("button", { name: "Get started" }).first().click();
  await expect(page).toHaveURL(/\/docs\/getting-started$/);
  await waitForNavIdle(page);
  expect(await shellTransition(page)).toBe("site-drill");

  await page.goto("/");
  await waitForNavIdle(page);
  await page.getByRole("button", { name: "Open playground" }).click();
  await expect(page).toHaveURL(/\/playground$/);
  await waitForNavIdle(page);
  expect(await shellTransition(page)).toBe("site-drill");
});

test("the page list opens and closes with motion, and a choice turns the page", async ({
  page
}) => {
  await page.goto("/docs/introduction");
  await waitForNavIdle(page);

  await page
    .getByRole("button", { name: /Getting started\s*Introduction/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\?nav=true$/);
  await expect(sheet(page)).toHaveAttribute("data-state", "open");
  expect(await sheetAnimations(page)).toContain("menu-panel-in");

  await sheet(page).getByRole("button", { name: "Morph", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/morph$/);
  await waitForNavIdle(page);
  expect(await docTransition(page)).toBe("doc-forward");
  await expect(sheet(page)).toHaveCount(0);

  // Back to the list, and an earlier page turns backward.
  await page
    .getByRole("button", { name: /Motion\s*Morph/ })
    .first()
    .click();
  await expect(sheet(page)).toHaveAttribute("data-state", "open");
  await page.goBack();
  await expect(sheet(page)).toHaveAttribute("data-state", "closed");
  expect(await sheetAnimations(page)).toContain("menu-panel-out");
  await expect(sheet(page)).toHaveCount(0);
});

test("a link in the page turns it rather than pushing with cupertino", async ({ page }) => {
  await page.goto("/docs/introduction");
  await waitForNavIdle(page);
  await page.getByRole("button", { name: /Next/ }).last().click();
  await waitForNavIdle(page);
  expect(await docTransition(page)).toBe("doc-forward");
});

test("a live demo's morph layer ranks only inside its own region", async ({ page }) => {
  await page.goto("/docs/morph");
  await waitForNavIdle(page);
  // Every nested Router region the page holds is its own stacking context, so
  // the layer's z-index cannot lift a moving Morph over the page list.
  const isolations = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-flemo-morph-layer]")]
      .map((layer) => layer.parentElement)
      .filter((region) => region?.closest("[data-flemo-screen]"))
      .map((region) => getComputedStyle(region!).isolation)
  );
  expect(isolations.length).toBeGreaterThan(0);
  expect(new Set(isolations)).toEqual(new Set(["isolate"]));
});
