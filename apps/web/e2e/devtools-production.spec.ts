import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// DEVTOOLS MUST NOT REACH A VISITOR.
//
// The package resolves `@flemo/devtools/react` to a component that renders null
// under the `production` export condition, and this suite runs against
// `next build && next start` — so this is that promise, checked on the real
// output rather than trusted.
//
// It is checked because it has been broken. Devtools strings were found in a
// production chunk of this site once before (PR #271), and again while the
// on-device readout was being added: reaching for `@flemo/devtools/force` to
// make the instrument exist in a production build put the real panel and
// readout straight back into a public chunk. The specifier survives whatever
// guard is wrapped around it — `NEXT_PUBLIC_*` is only substituted when it is
// SET, so an unset flag folds nothing away.
//
// The playground mounts `<FlemoDevtools />` unconditionally, which is the whole
// point of the component: there is no guard for a consumer to get wrong, and
// this test is what says so.
test.describe("devtools in a production build", () => {
  test("the playground mounts no devtools surface", async ({ page }) => {
    await page.goto("/en/playground");
    await waitForNavIdle(page);
    // Give a lazy import every chance to land before concluding it did not.
    await page.waitForTimeout(1500);

    expect(await page.locator("[data-flemo-devtools-panel]").count()).toBe(0);
  });

  test("asking for it changes nothing, because there is nothing to ask for", async ({ page }) => {
    await page.goto("/en/playground?devtools=on");
    await waitForNavIdle(page);
    await page.waitForTimeout(1500);

    expect(await page.locator("[data-flemo-devtools-panel]").count()).toBe(0);
  });
});
