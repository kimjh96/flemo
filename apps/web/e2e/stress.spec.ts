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

  test("useStep replaceStep tab cycling 18× on NowPlaying (no remount)", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    // Drive to NowPlaying so useStep's routePath resolves to /now-playing.
    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);
    await activeScreen(page)
      .getByRole("button", { name: /^Play / })
      .click();
    await waitForTransitionSettled(page);

    // 3 screens mounted — pin before the burst so the later count assertion
    // proves replaceStep added no new entries.
    expect(await allScreens(page).count()).toBe(3);

    const tabs = ["Up Next", "Lyrics", "Player"] as const;
    for (let i = 0; i < 18; i++) {
      const target = tabs[i % tabs.length]!;
      await page.getByRole("tab", { name: target }).click();
      // replaceStep updates ParamsContext via dispatch; aria-selected on the
      // new tab flips synchronously after the task settles.
      await expect(page.getByRole("tab", { name: target })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    }

    // Critical invariant: screen count unchanged. replaceStep doesn't push
    // a new history entry — only the existing NowPlaying entry's state is
    // mutated.
    expect(await allScreens(page).count()).toBe(3);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("useStep pushStep + popStep round-trip 8× (expand + collapse details)", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    await albumTile(page, 0).click();
    await waitForTransitionSettled(page);
    await activeScreen(page)
      .getByRole("button", { name: /^Play / })
      .click();
    await waitForTransitionSettled(page);

    for (let i = 0; i < 8; i++) {
      // pushStep — Player tab "Show album details" button.
      await page.getByRole("button", { name: "Show album details" }).click();
      await expect(page.locator('[data-flemo-step-pane-detail="player-expanded"]')).toBeVisible();

      // popStep — the explicit Close button on the detail pane.
      await page.getByRole("button", { name: "Close details" }).click();
      await expect(
        page.locator('[data-flemo-step-pane-detail="player-expanded"]')
      ).not.toBeVisible();
    }

    // Stack stays at three screens for the entire round-trip.
    expect(await allScreens(page).count()).toBe(3);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("6-API mixed storm: push + replace + pop + pushStep + replaceStep + popStep × 3", async ({
    page
  }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/playground");
    await waitForTransitionSettled(page);

    // Each iteration touches every navigate-API verb the playground exposes:
    //
    //   navigate.replace    — Library segment + Tab bar
    //   navigate.push       — Library → Album → NowPlaying
    //   navigate.pop        — back to Album, back to Library
    //   useStep.replaceStep — switch NowPlaying tab
    //   useStep.pushStep    — expand album details (Player tab)
    //   useStep.popStep     — collapse details (pane button + header Close)
    for (let i = 0; i < 3; i++) {
      // (1) navigate.replace — segment switch
      await page.getByRole("button", { name: "Songs" }).click();
      await waitForTransitionSettled(page);
      await page.getByRole("button", { name: "Albums" }).click();
      await waitForTransitionSettled(page);

      // (2) navigate.replace — tab nav round-trip via TabBar
      await page.getByRole("button", { name: "Search" }).click();
      await waitForTransitionSettled(page);
      await page.getByRole("button", { name: "Library" }).click();
      await waitForTransitionSettled(page);

      // (3) navigate.push × 2 — Library → Album → NowPlaying
      await albumTile(page, i % 4).click();
      await waitForTransitionSettled(page);
      await activeScreen(page)
        .getByRole("button", { name: /^Play / })
        .click();
      await waitForTransitionSettled(page);

      // (4) useStep.replaceStep — switch to Up Next
      await page.getByRole("tab", { name: "Up Next" }).click();
      await expect(page.getByRole("tab", { name: "Up Next" })).toHaveAttribute(
        "aria-selected",
        "true"
      );

      // (5) useStep.replaceStep — back to Player (where pushStep target lives)
      await page.getByRole("tab", { name: "Player" }).click();
      await expect(page.getByRole("tab", { name: "Player" })).toHaveAttribute(
        "aria-selected",
        "true"
      );

      // (6) useStep.pushStep — expand details
      await page.getByRole("button", { name: "Show album details" }).click();
      await expect(page.locator('[data-flemo-step-pane-detail="player-expanded"]')).toBeVisible();

      // (7) useStep.popStep — collapse via dedicated Close button
      await page.getByRole("button", { name: "Close details" }).click();
      await expect(
        page.locator('[data-flemo-step-pane-detail="player-expanded"]')
      ).not.toBeVisible();

      // (8) navigate.pop × 2 — header Close uses popStep but crosses the
      // step boundary into a screen pop because no steps remain. Then the
      // Album back button screen-pops to Library.
      await page.getByRole("button", { name: "Close" }).click();
      await waitForTransitionSettled(page);
      await page.getByRole("button", { name: "Back" }).click();
      await waitForTransitionSettled(page);
    }

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
