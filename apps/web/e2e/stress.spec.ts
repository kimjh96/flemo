import { expect, test } from "@playwright/test";

import {
  albumTile,
  allScreens,
  trackConsoleErrors,
  waitForTransitionSettled
} from "./helpers/flemo";

test.describe("playground — stress", () => {
  test("push/pop chain 10×: history collapses back to the root with no DOM leak", async ({
    page
  }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    for (let i = 0; i < 10; i++) {
      await albumTile(page, 0).click();
      await expect(page).toHaveURL(/\/album\/[^/]+$/);
      await waitForTransitionSettled(page);

      await page.getByRole("button", { name: "Back" }).click();
      await expect(page).toHaveURL(/\/(\?.*)?$/);
      await waitForTransitionSettled(page);
    }

    expect(await allScreens(page).count()).toBe(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("rapid push during in-flight transition is ignored (push-guard)", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    // Fire two pushes back-to-back without waiting. `useNavigate.push` early-
    // returns when `status !== COMPLETED && status !== IDLE`, so only the
    // first push should land on the history stack.
    await Promise.all([albumTile(page, 0).click(), albumTile(page, 1).click()]);

    await waitForTransitionSettled(page);
    // Library + exactly one Album = 2.
    expect(await allScreens(page).count()).toBe(2);
  });

  test("tab nav 20×: Library ↔ Search settles at the expected end state", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    for (let i = 0; i < 20; i++) {
      const target = i % 2 === 0 ? "Search" : "Library";
      await page.getByRole("button", { name: target }).click();
      await waitForTransitionSettled(page);
    }

    // i=0 → Search, i=1 → Library, ..., i=19 → Library. Final = Library.
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("segment switching 12×: Library remounts repeatedly without queue stalls", async ({
    page
  }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    const segments = ["Songs", "Artists", "Albums"] as const;
    for (let i = 0; i < 12; i++) {
      const target = segments[i % segments.length]!;
      await page.getByRole("button", { name: target }).click();
      await waitForTransitionSettled(page);
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("mixed storm: push / pop / tab / segment interleaved 8×", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    for (let i = 0; i < 8; i++) {
      const op = i % 4;
      if (op === 0) {
        await albumTile(page, 0).click();
        await waitForTransitionSettled(page);
        await page.getByRole("button", { name: "Back" }).click();
        await waitForTransitionSettled(page);
      } else if (op === 1) {
        await page.getByRole("button", { name: "Search" }).click();
        await waitForTransitionSettled(page);
        await page.getByRole("button", { name: "Library" }).click();
        await waitForTransitionSettled(page);
      } else if (op === 2) {
        await page.getByRole("button", { name: "Songs" }).click();
        await waitForTransitionSettled(page);
        await page.getByRole("button", { name: "Albums" }).click();
        await waitForTransitionSettled(page);
      } else {
        await page.getByRole("switch").click();
        await waitForTransitionSettled(page);
        await page.getByRole("switch").click();
        await waitForTransitionSettled(page);
      }
    }

    // End state should be Library /albums with mini-player on (matches boot).
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
