import type { Page } from "@playwright/test";

// Stable harness for measuring whether a View-Transition snapshot escapes
// flemo's clipping container (the playground phone frame).
//
// Two things make a naive probe unreliable, both handled here:
//   1. The playground page SCROLLS during the transition, so the frame moves in
//      the viewport. Measure the frame DURING the VT (same moment as the pixel
//      sampling), never at rest — otherwise the probe samples empty space while
//      the snapshot sits elsewhere (the source of earlier false 0s / false 84s).
//   2. Timing: key off flemo's injected `#flemo-view-transition` style being
//      present, then a small fixed offset — not a blind delay from the click.
//
// The probe counts magenta pixels (the fetch-swap repro screen's edge marker)
// in thin strips just OUTSIDE each edge of the frame. 0 on every edge ⇒ the
// snapshot is fully contained.

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const measureActiveFrame = (page: Page): Promise<Rect> =>
  page.evaluate(() => {
    const active = document.querySelector(
      '[data-flemo-screen][data-flemo-active="true"]'
    ) as HTMLElement | null;
    let el = active?.parentElement ?? null;
    let frame: HTMLElement | null = null;
    while (el) {
      const cs = getComputedStyle(el);
      if (cs.overflow === "hidden" && cs.transform !== "none") {
        frame = el;
        break;
      }
      el = el.parentElement;
    }
    const r = (frame ?? active!).getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height)
    };
  });

const magentaIn = async (
  page: Page,
  clip: { x: number; y: number; width: number; height: number }
): Promise<number> => {
  if (clip.width <= 0 || clip.height <= 0 || clip.x < 0 || clip.y < 0) return 0;
  const shot = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const cx = cv.getContext("2d")!;
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] > 120) n++;
    }
    return n;
  }, shot.toString("base64"));
};

export interface VtEscape {
  frame: Rect;
  left: number;
  right: number;
  above: number;
  below: number;
}

// Fire the push for `testId`, wait for the VT to be live, then measure marker
// escape on all four edges relative to the frame's CURRENT (mid-transition)
// position. Use a fixed viewport in the calling spec so the frame is deterministic.
export async function probeVtEscape(
  page: Page,
  testId: string,
  { offsetMs = 70 }: { offsetMs?: number } = {}
): Promise<VtEscape> {
  await page.getByTestId(testId).click();
  await page
    .waitForFunction(() => !!document.querySelector("#flemo-view-transition"), { timeout: 2000 })
    .catch(() => {});
  await page.waitForTimeout(offsetMs);

  const frame = await measureActiveFrame(page);
  const left = await magentaIn(page, { x: frame.x - 13, y: frame.y, width: 12, height: frame.h });
  const right = await magentaIn(page, {
    x: frame.x + frame.w + 1,
    y: frame.y,
    width: 12,
    height: frame.h
  });
  const above = await magentaIn(page, { x: frame.x, y: frame.y - 13, width: frame.w, height: 12 });
  const below = await magentaIn(page, {
    x: frame.x,
    y: frame.y + frame.h + 1,
    width: frame.w,
    height: 12
  });
  return { frame, left, right, above, below };
}
