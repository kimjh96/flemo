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
          // A BOX IN THE RIGHT PLACE IS NOT A LINE IN THE RIGHT PLACE.
          //
          // The box is where the flight puts the element; the baseline is where
          // the eye reads it, and the two are a half-leading and an ascent
          // apart. A title whose box began exactly where it sat still began a
          // whole pixel high, in both engines and on every bench, because the
          // machinery that pays that difference was emitted and never worn.
          // Watching the box alone let that through for a release.
          const baseline = (node: Element): number => {
            const mark = document.createElement("span");
            mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
            node.appendChild(mark);
            const top = mark.getBoundingClientRect().top;
            mark.remove();
            return top;
          };
          const before = new Map<string, { box: number; line: number }>();
          for (const host of document.querySelectorAll("[data-flemo-morph-name]")) {
            for (const node of [...host.querySelectorAll("*")].filter(text)) {
              before.set((node.textContent ?? "").trim(), {
                box: node.getBoundingClientRect().top,
                line: baseline(node)
              });
            }
          }
          const first: { text: string; moved: number; line: number }[] = [];
          const seen = new Set<string>();
          const tick = () => {
            for (const node of document.querySelectorAll('[data-flemo-morph="enter"]')) {
              if (!text(node)) continue;
              const key = (node.textContent ?? "").trim();
              const was = before.get(key);
              if (was === undefined || seen.has(key)) continue;
              seen.add(key);
              first.push({
                text: key.slice(0, 24),
                moved: node.getBoundingClientRect().top - was.box,
                line: baseline(node) - was.line
              });
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
          return (window as unknown as { __first: { text: string; moved: number; line: number }[] })
            .__first;
        });

        for (const jump of jumps) {
          expect(
            Math.abs(jump.moved),
            `"${jump.text}" began ${jump.moved.toFixed(2)}px from where it sat`
          ).toBeLessThanOrEqual(1.5);
          // Tighter than the box, deliberately. The box is allowed the rounding
          // a device grid puts on a travel; the baseline is not travelling at
          // all on its first frame, and every correction in this area exists to
          // put it back exactly. A pixel and a half of slack here is what let a
          // one-pixel defect ship: measured across seven benches and two
          // surfaces in both engines, the corrected line is 0.00px every time.
          expect(
            Math.abs(jump.line),
            `"${jump.text}" drew its first line ${jump.line.toFixed(2)}px from where it sat`
          ).toBeLessThanOrEqual(0.6);
        }
      });
    }
  }
});
