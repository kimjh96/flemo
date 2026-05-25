import { expect, test } from "@playwright/test";

import {
  activeScreen,
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

  test("push during in-flight transition is ignored (push-guard)", async ({ page }) => {
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    // Land the first push, then — while the transition is still PUSHING —
    // fire a programmatic click on a Library tile underneath the new Album.
    // `useNavigate.push` early-returns when status is anything other than
    // COMPLETED or IDLE, so the second push is dropped on the floor and
    // we should end with exactly one Album on top of Library.
    //
    // We click via page.evaluate because Playwright's auto-waiting .click()
    // would block on pointer-event accessibility — the new Album screen
    // already intercepts pointer events on top of Library.
    await albumTile(page, 0).click();

    // Wait until we're actually in the PUSHING window.
    await page.waitForFunction(
      () => !!document.querySelector('[data-flemo-screen][data-flemo-status="PUSHING"]')
    );

    await page.evaluate(() => {
      const hiddenLibraryTiles = document.querySelectorAll<HTMLButtonElement>(
        '[data-flemo-screen][data-flemo-active="false"] button:has(.aspect-square)'
      );
      // Click a different tile than the first to make the assertion concrete
      // — if the guard fails we'd see two distinct Albums stacked.
      hiddenLibraryTiles[1]?.click();
    });

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

  test("deep stack 3-level (Library → Album → NowPlaying) then bulk pop, repeated 5×", async ({
    page
  }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    for (let i = 0; i < 5; i++) {
      // push #1: Library → Album
      await albumTile(page, i % 4).click();
      await expect(page).toHaveURL(/\/album\/[^/]+$/);
      await waitForTransitionSettled(page);

      // push #2: Album → NowPlaying via the artwork "Play <album>" button.
      await activeScreen(page)
        .getByRole("button", { name: /^Play / })
        .click();
      await expect(page).toHaveURL(/\/now-playing$/);
      await waitForTransitionSettled(page);

      // Mid-stress: 3 screens mounted.
      expect(await allScreens(page).count()).toBe(3);

      // Bulk pop: NowPlaying → Album → Library, both via browser back.
      await page.goBack();
      await waitForTransitionSettled(page);
      await page.goBack();
      await waitForTransitionSettled(page);

      // Back at the Library root.
      await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
      expect(await allScreens(page).count()).toBe(1);
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("push + replace + pop interleaved 6× (real navigate API mix)", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    const segments = ["Songs", "Artists", "Albums"] as const;

    // Each iteration touches all three navigate verbs in order:
    //   1. replace — Library segment switch (`navigate.replace("/", {...})`)
    //   2. replace — Tab nav into Search (`navigate.replace("/search", ...)`)
    //   3. replace — Tab nav back to Library
    //   4. push   — Library → Album
    //   5. pop    — Album → Library
    // The Library root is shared by replace and push origins, so this is
    // the closest mix of all three on the same screen flow.
    for (let i = 0; i < 6; i++) {
      const segment = segments[i % segments.length]!;
      await page.getByRole("button", { name: segment }).click();
      await waitForTransitionSettled(page);

      await page.getByRole("button", { name: "Search" }).click();
      await waitForTransitionSettled(page);

      await page.getByRole("button", { name: "Library" }).click();
      await waitForTransitionSettled(page);

      await albumTile(page, i % 4).click();
      await expect(page).toHaveURL(/\/album\/[^/]+$/);
      await waitForTransitionSettled(page);

      await page.getByRole("button", { name: "Back" }).click();
      await waitForTransitionSettled(page);
    }

    // End on Library — push/replace/pop in any combination must converge.
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    expect(await allScreens(page).count()).toBe(1);
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
