import { expect, test } from "@playwright/test";

// Regression repro: on the compiled tier (desktop Blink routes there on this
// branch), RAPID consecutive pushes intermittently SWALLOW the slide — the
// entering animation is cancelled ~2 frames after it starts (animationcancel
// at elapsed≈0) while the navigation still commits. Device report: "연타할 때
// 트랜지션이 씹히고 전환된다". main (desktop → rAF player) has no swallow.
//
// This drives the swallow headlessly so it can be fixed and guarded without a
// human tapping. It installs an animation event counter, fires a burst of
// Next clicks with NO nav-idle wait between them (forcing flight overlap), and
// reports how many flights ended cleanly vs were cancelled mid-opening.
test("rapid Next taps never swallow the slide (no early animationcancel)", async ({
  page
}, testInfo) => {
  // Desktop Blink (chromium) is where rapid pushes route to the COMPILED tier
  // and a mid-opening animationcancel IS the swallow this guards. The touch
  // project (mobile-chromium) keeps the rAF PLAYER, where interrupting a
  // flight to start the next tap legitimately cancels the outgoing animation —
  // a cancel there is normal, not a swallow — so the assertion doesn't apply.
  test.skip(
    testInfo.project.name !== "chromium",
    "compiled-tier swallow repro; touch Blink uses the player where mid-flight cancels are legitimate"
  );
  await page.goto("/playground");
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

  // Drive the burst from INSIDE the page: real rapid taps, not Playwright's
  // per-click actionability overhead (which spaces clicks too far to overlap).
  const result = await page.evaluate(async () => {
    const isFlight = (name: string) =>
      name.includes("PUSHING-true") || name.includes("PUSHING-false");
    let ends = 0;
    const cancelMs: number[] = [];
    const timeline: string[] = [];
    const t0 = performance.now();
    const now = () => Math.round(performance.now() - t0);
    document.addEventListener(
      "animationend",
      (e) => {
        if (isFlight((e as AnimationEvent).animationName)) ends += 1;
      },
      true
    );
    document.addEventListener(
      "animationstart",
      (e) => {
        const ev = e as AnimationEvent;
        if (isFlight(ev.animationName))
          timeline.push(`${now()} START ${ev.animationName.slice(-13)}`);
      },
      true
    );
    document.addEventListener(
      "animationcancel",
      (e) => {
        const ev = e as AnimationEvent;
        if (!isFlight(ev.animationName)) return;
        const ms = Math.round(ev.elapsedTime * 1000);
        cancelMs.push(ms);
        timeline.push(`${now()} CANCEL ${ev.animationName.slice(-13)} elapsed=${ms}`);
      },
      true
    );
    // Watch the attributes the compiled @keyframes rule matches on: a flip of
    // data-flemo-status (PUSHING→COMPLETED) or data-flemo-anim-hold un-matches
    // the rule and cancels the running animation.
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as Element;
        const attr = r.attributeName!;
        timeline.push(
          `${now()} ATTR ${attr.replace("data-flemo-", "")} ${r.oldValue}→${el.getAttribute(attr)}`
        );
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["data-flemo-status", "data-flemo-anim-hold"]
    });
    const findNext = (): HTMLButtonElement | null => {
      for (const b of Array.from(document.querySelectorAll("button"))) {
        if (b.textContent?.trim() === "Next") return b as HTMLButtonElement;
      }
      return null;
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 18; i += 1) {
      findNext()?.click();
      await sleep(130);
    }
    await sleep(1400);
    const earlyCancels = cancelMs.filter((ms) => ms < 100).length;
    return { ends, cancels: cancelMs.length, earlyCancels, cancelMs, timeline };
  });
  // eslint-disable-next-line no-console
  console.log("SUMMARY:", JSON.stringify({ ...result, timeline: undefined }));
  // Print the timeline window around each early (swallowed) cancel.
  const tl = result.timeline;
  result.timeline.forEach((line, i) => {
    if (line.includes("CANCEL") && /elapsed=\d\b|elapsed=[1-9]\d\b/.test(line)) {
      // eslint-disable-next-line no-console
      console.log("--- swallow window ---\n" + tl.slice(Math.max(0, i - 6), i + 2).join("\n"));
    }
  });

  expect(result.earlyCancels, "flights swallowed (cancelled mid-opening)").toBe(0);
});
