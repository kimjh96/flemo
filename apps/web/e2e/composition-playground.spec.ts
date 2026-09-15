import { expect, test } from "@playwright/test";

import { trackConsoleErrors, waitForNavIdle } from "./helpers/flemo";

test.describe("composition playground", () => {
  test("keeps local and root Router ownership separate", async ({ page }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/en/playground/composition");
    await waitForNavIdle(page);

    await expect(page.locator("[data-composition-header]").getByText("Inbox")).toBeVisible();
    await page.getByRole("button", { name: "Local filters" }).click();
    await waitForNavIdle(page);

    await expect(page.getByTestId("composition-pane-filters")).toBeVisible();
    await expect(page.locator("[data-composition-header]").getByText("Inbox")).toBeVisible();

    await page.getByRole("button", { name: "Local back" }).click();
    await waitForNavIdle(page);
    await page.getByRole("button", { name: "Open from nested pane" }).click();
    await waitForNavIdle(page);

    await expect(page.getByTestId("composition-detail")).toBeVisible();
    await expect(page.locator("[data-composition-header]").getByText("Brief")).toBeVisible();

    await page.getByRole("button", { name: "Back to workspace" }).click();
    await waitForNavIdle(page);
    await expect(page.getByTestId("composition-pane-list")).toBeVisible();
    expect(errors).toEqual([]);
  });

  // THE HAND-OVER NEVER PRINTS BOTH SENTENCES LEGIBLY AT ONCE. Counting
  // painted copies is the assertion class whose absence let the defect ship:
  // each side's own opacity read as a healthy fade while the pair doubled.
  test("hands the card copy over without doubling it", async ({ page }) => {
    await page.goto("/en/playground/composition");
    await waitForNavIdle(page);

    const doubled = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const paint = (node: Element) => {
            let value = 1;
            for (let el: Element | null = node; el; el = el.parentElement) {
              value *= Number(getComputedStyle(el).opacity);
            }
            return value;
          };
          let worst = 0;
          const read = (started: number) => {
            const elapsed = performance.now() - started;
            const sentences = new Map<string, number>();
            for (const p of Array.from(document.querySelectorAll("[data-flemo-morph-layer] p"))) {
              const text = (p.textContent ?? "").trim();
              if (!/^(Open the story|One story,)/.test(text)) continue;
              const key = text.slice(0, 9);
              sentences.set(key, Math.max(sentences.get(key) ?? 0, paint(p)));
            }
            const open = sentences.get("Open the ") ?? 0;
            const one = sentences.get("One story") ?? 0;
            worst = Math.max(worst, Math.min(open, one));
            if (elapsed < 640) requestAnimationFrame(() => read(started));
            else resolve(worst);
          };
          document.querySelector<HTMLElement>('[data-testid="composition-featured"]')!.click();
          read(performance.now());
        })
    );
    // Both sentences above half-ink on one frame is the doubling the reviewer
    // saw; the crossing of a short hand-over stays well under it.
    expect(doubled).toBeLessThan(0.5);
  });

  test("escapes a nested overlay into the outer Layer host above shared chrome", async ({
    page
  }) => {
    const { errors } = trackConsoleErrors(page);
    await page.goto("/en/playground/composition");
    await waitForNavIdle(page);

    const header = page.locator("[data-composition-header]");
    await expect(header.getByText("Inbox")).toBeVisible();
    await page.getByRole("button", { name: "Open command layer" }).click();

    const overlay = page.getByTestId("composition-layer-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Quick actions" })).toBeVisible();

    const placement = await page.evaluate(() => {
      const overlay = document.querySelector<HTMLElement>(
        '[data-testid="composition-layer-overlay"]'
      );
      const header = document.querySelector<HTMLElement>("[data-composition-header]");
      const slot = overlay?.closest<HTMLElement>("[data-flemo-layer-slot]");
      const host = overlay?.closest<HTMLElement>("[data-flemo-layer-host]");
      const headerRect = header?.getBoundingClientRect();
      const overlayRect = overlay?.getBoundingClientRect();
      const hit = headerRect
        ? document.elementFromPoint(
            headerRect.left + headerRect.width / 2,
            headerRect.top + headerRect.height / 2
          )
        : null;

      return {
        coversHeader:
          !!headerRect &&
          !!overlayRect &&
          overlayRect.left <= headerRect.left &&
          overlayRect.right >= headerRect.right &&
          overlayRect.top <= headerRect.top &&
          overlayRect.bottom >= headerRect.bottom,
        hitIsOverlay: !!overlay && !!hit && overlay.contains(hit),
        hostContainsSlot: !!host && !!slot && host.contains(slot),
        insideNestedScreen: !!overlay?.closest('[data-testid="composition-pane-list"]'),
        owner: slot?.getAttribute("data-flemo-layer-owner") ?? null
      };
    });

    expect(placement.coversHeader).toBe(true);
    expect(placement.hitIsOverlay).toBe(true);
    expect(placement.hostContainsSlot).toBe(true);
    expect(placement.insideNestedScreen).toBe(false);
    expect(placement.owner).not.toBeNull();

    await page.getByRole("button", { name: "Close command layer" }).click();
    await expect(overlay).toHaveCount(0);
    await expect(page.getByTestId("composition-pane-list")).toBeVisible();
    await expect(header.getByText("Inbox")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("flies the root-owned featured Morph in both directions", async ({ page }) => {
    await page.goto("/en/playground/composition");
    await waitForNavIdle(page);

    const sourceTitle = await page
      .locator('[data-flemo-morph-id="composition-featured-title"]')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          display: style.display,
          fontSize: Number.parseFloat(style.fontSize),
          x: rect.x,
          y: rect.y
        };
      });
    expect(sourceTitle).toMatchObject({ display: "block", fontSize: 20 });

    await page.getByTestId("composition-featured").click();
    await expect(
      page.locator('[data-flemo-morph="enter"][data-flemo-morph-id="composition-featured"]')
    ).toBeVisible();
    await page.waitForFunction(() => {
      const title = document.querySelector<HTMLElement>(
        '[data-flemo-morph="enter"][data-flemo-morph-id="composition-featured-title"]'
      );
      return title
        ?.getAnimations()
        .some(
          (animation) => typeof animation.currentTime === "number" && animation.currentTime >= 150
        );
    });

    const pushFrame = await page.evaluate(() => {
      const parts = Array.from(
        document.querySelectorAll<HTMLElement>("[data-flemo-part-name]")
      ).map((part) => ({
        active: part.getAttribute("data-flemo-active"),
        opacity: Number.parseFloat(getComputedStyle(part).opacity),
        duration: getComputedStyle(part).animationDuration,
        animation: getComputedStyle(part).animationName,
        name: part.getAttribute("data-flemo-part-name"),
        status: part.getAttribute("data-flemo-status")
      }));
      const title = document.querySelector<HTMLElement>(
        '[data-flemo-morph-id="composition-featured-title"][data-flemo-morph="enter"]'
      );
      const ghostHidesTitle = Array.from(
        document.querySelectorAll<HTMLElement>("[data-flemo-morph-ghost] span")
      ).some((span) => span.textContent?.trim() === "Morning brief" && span.style.opacity === "0");
      const titleStyle = title ? getComputedStyle(title) : null;
      const titleRect = title?.getBoundingClientRect();
      const visibleTitleCount = Array.from(document.querySelectorAll<HTMLElement>("span")).filter(
        (span) => {
          if (span.childElementCount > 0 || span.textContent?.trim() !== "Morning brief")
            return false;
          for (let node: HTMLElement | null = span; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number.parseFloat(style.opacity) <= 0.01
            )
              return false;
          }
          return true;
        }
      ).length;

      return {
        ghostHidesTitle,
        parts,
        visibleTitleCount,
        title:
          titleStyle && titleRect
            ? {
                animation: titleStyle.animationName,
                display: titleStyle.display,
                fontSize: Number.parseFloat(titleStyle.fontSize),
                translate: titleStyle.translate,
                x: titleRect.x,
                y: titleRect.y
              }
            : null
      };
    });

    for (const name of ["composition-header-title", "composition-header-action"]) {
      const arriving = pushFrame.parts.find((part) => part.name === name && part.active === "true");
      const departing = pushFrame.parts.find(
        (part) => part.name === name && part.active === "false"
      );
      expect(arriving).toMatchObject({ duration: "0.7s", status: "PUSHING" });
      expect(departing).toMatchObject({ duration: "0.7s", status: "PUSHING" });
      expect(arriving?.animation).toContain(`flemo-part-${name}-PUSHING-true`);
      expect(departing?.animation).toContain(`flemo-part-${name}-PUSHING-false`);
      expect(arriving?.opacity).toBeGreaterThan(0);
      expect(arriving?.opacity).toBeLessThan(1);
      expect(departing?.opacity).toBeGreaterThan(0);
      expect(departing?.opacity).toBeLessThan(1);
    }
    expect(pushFrame.title).not.toBeNull();
    expect(pushFrame.title?.animation).toContain("flemo-morph");
    expect(pushFrame.title?.display).toBe("block");
    expect(pushFrame.title?.fontSize).toBeGreaterThan(sourceTitle.fontSize);
    expect(pushFrame.title?.fontSize).toBeLessThan(30);
    expect(pushFrame.title?.translate).not.toBe("none");
    expect(pushFrame.title?.y).toBeGreaterThan(sourceTitle.y);
    expect(pushFrame.ghostHidesTitle).toBe(true);
    expect(pushFrame.visibleTitleCount).toBe(1);
    const cardCopy = pushFrame.parts.filter(
      (part) => part.name === "composition-card-copy" && part.active === "true"
    );
    expect(cardCopy).toHaveLength(2);
    expect(cardCopy.every(({ opacity }) => opacity > 0 && opacity < 1)).toBe(true);

    await waitForNavIdle(page);

    const landed = await page.evaluate(async () => {
      const snapshots: Array<{
        animation: string;
        opacity: string;
        transform: string;
        x: number;
        y: number;
      }> = [];
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const part = document.querySelector<HTMLElement>(
          '[data-composition-header-title][data-flemo-active="true"]'
        );
        if (!part) continue;
        const style = getComputedStyle(part);
        const rect = part.getBoundingClientRect();
        snapshots.push({
          animation: style.animationName,
          opacity: style.opacity,
          transform: style.transform,
          x: rect.x,
          y: rect.y
        });
      }
      const title = document.querySelector<HTMLElement>(
        '[data-testid="composition-detail"] [data-flemo-morph-id="composition-featured-title"]'
      );
      const titleStyle = title ? getComputedStyle(title) : null;
      return {
        residues: document.querySelectorAll(
          '[data-flemo-morph="enter"], [data-flemo-morph="exit"], [data-flemo-morph-stand-in], [data-flemo-morph-ghost]'
        ).length,
        snapshots,
        title: titleStyle
          ? { display: titleStyle.display, fontSize: Number.parseFloat(titleStyle.fontSize) }
          : null
      };
    });

    expect(landed.residues).toBe(0);
    expect(landed.title).toEqual({ display: "block", fontSize: 30 });
    expect(landed.snapshots).toHaveLength(3);
    expect(landed.snapshots.every(({ animation }) => animation === "none")).toBe(true);
    expect(landed.snapshots.every(({ opacity }) => opacity === "1")).toBe(true);
    expect(landed.snapshots.every(({ transform }) => transform === "none")).toBe(true);
    expect(new Set(landed.snapshots.map(({ x }) => x)).size).toBe(1);
    expect(new Set(landed.snapshots.map(({ y }) => y)).size).toBe(1);

    await page.getByRole("button", { name: "Back to workspace" }).click();
    await expect(
      page.locator('[data-flemo-morph="enter"][data-flemo-morph-id="composition-featured"]')
    ).toBeVisible();
    await page.waitForFunction(() => {
      const title = document.querySelector<HTMLElement>(
        '[data-flemo-morph="enter"][data-flemo-morph-id="composition-featured-title"]'
      );
      return title
        ?.getAnimations()
        .some(
          (animation) => typeof animation.currentTime === "number" && animation.currentTime >= 150
        );
    });

    const popFrame = await page.evaluate(() => {
      const transformX = (element: HTMLElement) =>
        new DOMMatrixReadOnly(getComputedStyle(element).transform).m41;
      const enteringText = document.querySelector<HTMLElement>(
        '[data-flemo-morph-id="composition-featured-title"][data-flemo-morph="enter"]'
      );
      const enteringStyle = enteringText ? getComputedStyle(enteringText) : null;
      const parts = Array.from(
        document.querySelectorAll<HTMLElement>("[data-flemo-part-name]")
      ).map((part) => ({
        active: part.getAttribute("data-flemo-active"),
        animation: getComputedStyle(part).animationName,
        name: part.getAttribute("data-flemo-part-name"),
        status: part.getAttribute("data-flemo-status"),
        transformX: transformX(part)
      }));
      const screens = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="POPPING"]'
        )
      ).map((screen) => ({
        active: screen.getAttribute("data-flemo-active"),
        transformX: transformX(screen),
        width: screen.getBoundingClientRect().width
      }));

      return {
        enteringText: enteringStyle
          ? {
              animation: enteringStyle.animationName,
              display: enteringStyle.display,
              fontSize: Number.parseFloat(enteringStyle.fontSize),
              translate: enteringStyle.translate
            }
          : null,
        parts,
        screens
      };
    });

    expect(popFrame.enteringText?.animation).toContain("flemo-morph");
    expect(popFrame.enteringText?.display).toBe("block");
    expect(popFrame.enteringText?.fontSize).toBeGreaterThan(20);
    expect(popFrame.enteringText?.fontSize).toBeLessThan(30);
    expect(popFrame.enteringText?.translate).not.toBe("none");
    for (const name of ["composition-header-title", "composition-header-action"]) {
      expect(
        popFrame.parts.find((part) => part.name === name && part.active === "true")
      ).toMatchObject({ status: "POPPING" });
      expect(
        popFrame.parts.find((part) => part.name === name && part.active === "false")
      ).toMatchObject({ status: "POPPING" });
    }

    // A programmatic pop and a swipe-back walk the same POPPING poses. Since
    // the swipe is indexed by the screen's spatial progress, the automatic
    // flight must put both title copies at the same fraction of their path for
    // that screen position as well. Merely asserting a non-none transform did
    // not catch title easings that made the two interactions visibly disagree.
    const activeScreen = popFrame.screens.find(({ active }) => active === "true");
    const activeTitle = popFrame.parts.find(
      ({ active, name }) => active === "true" && name === "composition-header-title"
    );
    const returningTitle = popFrame.parts.find(
      ({ active, name }) => active === "false" && name === "composition-header-title"
    );
    expect(activeScreen).toBeDefined();
    expect(activeTitle).toBeDefined();
    expect(returningTitle).toBeDefined();
    if (activeScreen && activeTitle && returningTitle) {
      const screenProgress = activeScreen.transformX / activeScreen.width;
      expect(activeTitle.transformX / 72).toBeCloseTo(screenProgress, 2);
      expect((returningTitle.transformX + 72) / 72).toBeCloseTo(screenProgress, 2);
    }

    await waitForNavIdle(page);
    await expect(page.getByTestId("composition-featured")).toBeVisible();
    await expect(page.locator('[data-flemo-morph="enter"]')).toHaveCount(0);
    await expect(page.locator('[data-flemo-morph="exit"]')).toHaveCount(0);
  });

  test("scrubs both shared-header Part sides without swipe hooks", async ({ page }) => {
    await page.goto("/en/playground/composition");
    await waitForNavIdle(page);
    await page.getByTestId("composition-featured").click();
    await waitForNavIdle(page);

    const stage = await page.locator("[data-playground-stage]").boundingBox();
    expect(stage).not.toBeNull();
    if (!stage) return;

    const y = stage.y + stage.height / 2;
    await page.mouse.move(stage.x + 3, y);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.32, y, { steps: 12 });
    await page.mouse.move(stage.x + stage.width * 0.12, y, { steps: 8 });
    await page.waitForTimeout(50);

    const poses = await page.evaluate(() => {
      const values: Record<string, { opacity: number; transform: string }> = {};
      for (const part of document.querySelectorAll<HTMLElement>(
        '[data-flemo-part-name="composition-header-title"]'
      )) {
        const style = getComputedStyle(part);
        values[part.getAttribute("data-flemo-active") ?? "missing"] = {
          opacity: Number.parseFloat(style.opacity),
          transform: style.transform
        };
      }
      const title = document.querySelector<HTMLElement>(
        '[data-flemo-morph-id="composition-featured-title"][data-flemo-morph="enter"]'
      );
      return {
        titleDisplay: title ? getComputedStyle(title).display : null,
        values
      };
    });

    expect(poses.titleDisplay).toBe("block");
    expect(poses.values.true?.opacity).toBeGreaterThan(0);
    expect(poses.values.true?.opacity).toBeLessThan(1);
    expect(poses.values.false?.opacity).toBeGreaterThan(0);
    expect(poses.values.false?.opacity).toBeLessThan(1);
    expect(poses.values.true?.transform).not.toBe("none");
    expect(poses.values.false?.transform).not.toBe("none");

    await page.mouse.up();
    await waitForNavIdle(page);
    await expect(page.getByTestId("composition-detail")).toBeVisible();
    await expect(
      page.locator('[data-composition-header-title][data-flemo-active="true"]')
    ).toContainText("Brief");
    await page.waitForTimeout(500);

    await page.mouse.move(stage.x + 3, y);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.68, y, { steps: 16 });
    await page.waitForTimeout(50);
    await page.mouse.up();
    await waitForNavIdle(page);
    await expect(page.getByTestId("composition-featured")).toBeVisible();
    await expect(
      page.locator('[data-composition-header-title][data-flemo-active="true"]')
    ).toContainText("Inbox");
  });
});
