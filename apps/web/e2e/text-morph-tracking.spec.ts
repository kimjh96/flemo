import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// A TEXT MORPH STARTS AT THE TRACKING ITS DEPARTURE HAD.
//
// The Tonight list's title is untracked (`letter-spacing: normal`) and the
// detail's heading is tracked at -0.02em. `normal` used to be declined as a
// keyword, which dropped the tracking channel, so the arriving words wore the
// heading's tracking from the first frame: tight at the start of a push and
// wide at the start of a pop, before the size had moved. `normal` adds no
// space, so it is read as 0px and interpolated like any length.

const spacing = (value: string) => (value === "normal" ? 0 : Number.parseFloat(value));

const sampleTitle = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const samples: { letterSpacing: string; fontSize: string }[] = [];
    (window as unknown as { __title: typeof samples }).__title = samples;
    const started = performance.now();
    const sample = () => {
      const title = [
        ...document.querySelectorAll("[data-flemo-morph-layer] [data-flemo-morph-name='text']")
      ].find((element) => !element.closest("[data-flemo-morph-ghost]"));
      if (title) {
        const style = getComputedStyle(title);
        samples.push({ letterSpacing: style.letterSpacing, fontSize: style.fontSize });
      }
      if (performance.now() - started < 1200) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

const readSamples = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => (window as unknown as { __title: { letterSpacing: string; fontSize: string }[] }).__title
  );

test("a push and its pop start the title at the departure's tracking", async ({ page }) => {
  await page.goto("/en/playground");
  await waitForNavIdle(page);
  const stage = page.locator("[data-playground-stage]");

  await sampleTitle(page);
  await stage.locator("button", { hasText: "Aria Wave" }).first().click();
  await waitForNavIdle(page);
  const push = await readSamples(page);
  expect(push.length).toBeGreaterThan(0);
  // Starts as the untracked label, ends as the tracked heading.
  expect(spacing(push[0]!.letterSpacing)).toBeCloseTo(0, 2);
  expect(spacing(push.at(-1)!.letterSpacing)).toBeLessThan(-0.1);

  await sampleTitle(page);
  await stage.getByRole("button", { name: /back/i }).first().click();
  await waitForNavIdle(page);
  const pop = await readSamples(page);
  expect(pop.length).toBeGreaterThan(0);
  // Starts as the tracked heading, ends as the untracked label.
  expect(spacing(pop[0]!.letterSpacing)).toBeLessThan(-0.1);
  expect(spacing(pop.at(-1)!.letterSpacing)).toBeCloseTo(0, 2);
});
