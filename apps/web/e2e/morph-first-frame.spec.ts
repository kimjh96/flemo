import { expect, test } from "@playwright/test";

import { waitForNavIdle } from "./helpers/flemo";

// A MORPH STARTS WHERE IT WAS, OR IT IS BROKEN.
//
// The regression net this file replaces was a still frame of the LANDING, and a
// still frame cannot see a flight that begins in the wrong place. Two defects
// walked straight through it in one afternoon: a title that started twelve
// pixels above the label it was flying from, and a position that ran ahead of
// its own size. Both were reported from the playground by eye, after passing.
//
// So this watches the FIRST frame instead. Every text that is about to fly is
// measured before the tap; the first frame of the flight is measured after it;
// and the two have to agree. A pixel and a half of slack is the rounding a
// device grid can put on either measurement — everything the corrections in
// this area are for is well inside it, and everything that broke was ten times
// outside it.
const CASES = ["zoom", "cupertino", "material", "layout", "reveal", "drift", "sheet"] as const;

// The bench opens on the list; the poster grid is the other shape a card flies
// from, and it is the one that caught the twelve-pixel jump. A pair FLIES from
// the list and RIDES its container from the grid, which are different code
// paths for the same defect.
const SCREENS = [
  { id: "tonight", label: null },
  { id: "posters", label: /posters/i }
] as const;

test.describe("a morph starts where it was", () => {
  for (const bench of CASES) {
    for (const screen of SCREENS) {
      test(`${bench} from ${screen.id}`, async ({ page }) => {
        await page.goto("/en/playground");
        await waitForNavIdle(page);

        await page.evaluate((id) => {
          const control = [...document.querySelectorAll("button, [role=tab], a")].find(
            (element) => (element.textContent ?? "").trim().toLowerCase() === id
          );
          (control as HTMLElement | undefined)?.click();
        }, bench);
        await page.waitForTimeout(400);

        if (screen.label) {
          const pattern = screen.label;
          await page.evaluate((source) => {
            const re = new RegExp(source, "i");
            const tab = [...document.querySelectorAll("a, button, [role=tab]")].find((element) =>
              re.test((element.textContent ?? "").trim())
            );
            (tab as HTMLElement | undefined)?.click();
          }, pattern.source);
          await waitForNavIdle(page);
        }

        const target = await page.evaluate(() => {
          const all = [...document.querySelectorAll("[data-flemo-morph-name]")];
          const element = all.find((node) => node.getBoundingClientRect().width > 100) ?? all[0];
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        });
        test.skip(target === null, "no morph on this screen");

        // Where every flying text sits before the tap, and where it is on the
        // first frame it is airborne.
        await page.evaluate(() => {
          const text = (element: Element) =>
            element.childNodes.length === 1 && element.firstChild?.nodeType === 3;
          const before = new Map<string, number>();
          for (const host of document.querySelectorAll("[data-flemo-morph-name]")) {
            for (const node of [...host.querySelectorAll("*")].filter(text)) {
              before.set((node.textContent ?? "").trim(), node.getBoundingClientRect().top);
            }
          }
          const first: { text: string; moved: number }[] = [];
          const seen = new Set<string>();
          const tick = () => {
            for (const node of document.querySelectorAll('[data-flemo-morph="enter"]')) {
              if (!text(node)) continue;
              const key = (node.textContent ?? "").trim();
              const was = before.get(key);
              if (was === undefined || seen.has(key)) continue;
              seen.add(key);
              first.push({ text: key.slice(0, 24), moved: node.getBoundingClientRect().top - was });
            }
            if ((window as unknown as { __watch?: boolean }).__watch !== false) {
              requestAnimationFrame(tick);
            }
          };
          Object.assign(window, { __watch: true, __first: first });
          requestAnimationFrame(tick);
        });

        await page.mouse.click(target!.x, target!.y);
        await page.waitForTimeout(400);
        const jumps = await page.evaluate(() => {
          Object.assign(window, { __watch: false });
          return (window as unknown as { __first: { text: string; moved: number }[] }).__first;
        });

        for (const jump of jumps) {
          expect(
            Math.abs(jump.moved),
            `"${jump.text}" began ${jump.moved.toFixed(2)}px from where it sat`
          ).toBeLessThanOrEqual(1.5);
        }
      });
    }
  }
});
