import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import animateInline, { clearInlineAnimation, trackInlineWrite } from "@transition/animateInline";

// jsdom reads as non-Blink (no navigator.userAgentData), where the player
// defaults OFF; these suites exercise the player paths, so pin it on via
// the diagnostic force key.
beforeAll(() => sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`));
afterAll(() => sessionStorage.removeItem("flemo:motion-driver-force"));

const newDiv = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

describe("animateInline", () => {
  let el: HTMLDivElement;
  beforeEach(() => {
    el = newDiv();
  });
  afterEach(() => {
    el.remove();
    vi.useRealTimers();
  });

  it("resolves immediately with duration 0 + no inline transition", async () => {
    await animateInline(el, { x: 100, opacity: 0.5 }, { duration: 0 });
    expect(el.style.transform).toContain("translate3d(100px, 0, 0)");
    expect(el.style.opacity).toBe("0.5");
    expect(el.style.transition).toBe("none");
  });

  it("sets inline transition for nonzero duration and resolves on transitionend", async () => {
    const animation = animateInline(el, { x: 200 }, { duration: 0.3, ease: "easeOut" });

    // After the next tick, the inline `transition` should be primed and the
    // target value applied.
    await Promise.resolve();
    expect(el.style.transition).toContain("transform 0.3s");
    expect(el.style.transform).toContain("translate3d(200px, 0, 0)");

    // Dispatch transitionend manually to settle the promise.
    el.dispatchEvent(new Event("transitionend", { bubbles: true }));
    await expect(animation).resolves.toBeUndefined();
  });

  it("falls back to a safety timeout when transitionend never fires", async () => {
    vi.useFakeTimers();
    const animation = animateInline(el, { x: 50 }, { duration: 0.05 });
    // Advance past `duration + 60ms` safety margin.
    await vi.advanceTimersByTimeAsync(200);
    await expect(animation).resolves.toBeUndefined();
  });

  it("ignores non-HTMLElement targets without throwing", async () => {
    await expect(
      // @ts-expect-error: deliberately wrong type
      animateInline(null, { x: 0 }, { duration: 0.1 })
    ).resolves.toBeUndefined();
  });

  it("clearInlineAnimation strips exactly the properties animateInline wrote", async () => {
    // Hand-set styles that animateInline did NOT write should be left alone.
    // Only the properties it actually touched come off.
    el.style.color = "rgb(255, 0, 0)";
    await animateInline(el, { x: 50, opacity: 0.5 }, { duration: 0 });
    expect(el.style.transform).toContain("translate3d(50px, 0, 0)");
    expect(el.style.opacity).toBe("0.5");

    clearInlineAnimation(el);
    expect(el.style.transform).toBe("");
    expect(el.style.opacity).toBe("");
    expect(el.style.transition).toBe("");
    // Untouched hand-set property survives.
    expect(el.style.color).toBe("rgb(255, 0, 0)");
  });

  it("clearInlineAnimation also strips non-transform properties (filter, etc.) when animated", async () => {
    await animateInline(
      el,
      { filter: "blur(12px)", backgroundColor: "rgb(100, 100, 100)" },
      { duration: 0 }
    );
    expect(el.style.filter).toBe("blur(12px)");
    expect(el.style.backgroundColor).toBe("rgb(100, 100, 100)");

    clearInlineAnimation(el);
    expect(el.style.filter).toBe("");
    expect(el.style.backgroundColor).toBe("");
  });

  it("a timed write settles through the scrubbed Web Animation when WAAPI exists", async () => {
    const animation = {
      currentTime: null as number | null,
      paused: false,
      canceled: false,
      pause() {
        this.paused = true;
      },
      cancel() {
        this.canceled = true;
      }
    };
    el.animate = vi.fn(() => animation as unknown as Animation);

    const promise = animateInline(el, { x: 0, opacity: 1 }, { duration: 0.03, ease: "linear" });
    expect(animation.paused).toBe(true);
    expect(el.style.transition).toBe(""); // no CSS transition on the scrub path

    await promise;
    // Destination committed inline (same end-state contract as the CSS path)
    // and the animation dropped, so clearInlineAnimation keeps working.
    expect(el.style.transform).toBe("none");
    expect(el.style.opacity).toBe("1");
    expect(animation.canceled).toBe(true);
    clearInlineAnimation(el);
    expect(el.style.transform).toBe("");
    expect(el.style.opacity).toBe("");
  });

  it("clearInlineAnimation drops an in-flight settle without late writes", async () => {
    const animation = {
      currentTime: null as number | null,
      paused: false,
      canceled: false,
      pause() {
        this.paused = true;
      },
      cancel() {
        this.canceled = true;
      }
    };
    el.animate = vi.fn(() => animation as unknown as Animation);

    const promise = animateInline(el, { opacity: 0 }, { duration: 0.3 });
    // A cleanup (COMPLETED strip, unmount) hands the element to its rest
    // rules: the settle must die with it — no fill outranking the rest rule,
    // no final value written back after the strip.
    clearInlineAnimation(el);
    await promise;
    expect(animation.canceled).toBe(true);
    expect(el.style.opacity).toBe("");
  });

  it("keeps the CSS transition settle where the policy disallows the player", () => {
    const animate = vi.fn();
    el.animate = animate;
    // Engine default / demotion territory (e.g. WebKit): the compositor
    // drives the settle even though WAAPI exists.
    sessionStorage.setItem("flemo:motion-driver-force", `css@${Date.now()}`);

    void animateInline(el, { x: 0 }, { duration: 0.3 });
    expect(animate).not.toHaveBeenCalled();
    expect(el.style.transition).toContain("transform");

    sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`);
  });

  it("an instant write takes over a live settle (re-grab semantics)", () => {
    const animation = {
      currentTime: null as number | null,
      paused: false,
      canceled: false,
      pause() {
        this.paused = true;
      },
      cancel() {
        this.canceled = true;
      }
    };
    el.animate = vi.fn(() => animation as unknown as Animation);

    void animateInline(el, { x: 0 }, { duration: 0.3 });
    expect(animation.canceled).toBe(false);

    // The finger comes back down: duration-0 follow writes must not be
    // overridden by the lingering settle animation.
    void animateInline(el, { x: 120 }, { duration: 0 });
    expect(animation.canceled).toBe(true);
    expect(el.style.transform).toContain("120");
  });

  it("clearInlineAnimation falls back to transform + opacity for untracked elements", () => {
    // Element that animateInline never touched. Defensive fallback.
    el.style.transform = "translate3d(50px, 0, 0)";
    el.style.opacity = "0.5";
    el.style.transition = "transform 0.3s ease";
    clearInlineAnimation(el);
    expect(el.style.transform).toBe("");
    expect(el.style.opacity).toBe("");
    expect(el.style.transition).toBe("");
  });

  it("clearInlineAnimation with an explicit property list strips only those", () => {
    el.style.transform = "translate3d(50px, 0, 0)";
    el.style.opacity = "0.5";
    clearInlineAnimation(el, ["transform"]);
    expect(el.style.transform).toBe("");
    // opacity untouched
    expect(el.style.opacity).toBe("0.5");
  });

  it("preserves a consumer's animation longhands it did not write", () => {
    // A <Part> the consumer authored with its own timing-function and delay
    // that flemo never touched: COMPLETED cleanup must NOT strip them.
    el.style.animationTimingFunction = "steps(4)";
    el.style.animationDelay = "0.2s";
    trackInlineWrite(el, "transform"); // flemo leases transform BEFORE writing
    el.style.transform = "translate3d(10px, 0, 0)";
    clearInlineAnimation(el);
    expect(el.style.transform).toBe(""); // flemo's own write restored to none
    expect(el.style.animationTimingFunction).toBe("steps(4)"); // consumer's preserved
    expect(el.style.animationDelay).toBe("0.2s"); // consumer's preserved
  });

  it("restores a longhand flemo overwrote to the CONSUMER's original value", () => {
    // A consumer authored animation-delay: 0.2s; flemo's recovery leases it
    // BEFORE overwriting with a rejoin delay. Cleanup restores the consumer's
    // 0.2s, not a bare delete.
    el.style.animationDelay = "0.2s";
    trackInlineWrite(el, "animation-delay"); // captures "0.2s" as the original
    el.style.animationDelay = "-0.05s"; // flemo's rejoin
    clearInlineAnimation(el);
    expect(el.style.animationDelay).toBe("0.2s"); // consumer's original restored
  });

  it("removes a longhand flemo wrote where the consumer had none", () => {
    // No consumer value: flemo leases (captures ""), writes, cleanup removes.
    trackInlineWrite(el, "animation-timing-function");
    el.style.animationTimingFunction = "linear(0, 0.5, 1)";
    trackInlineWrite(el, "animation-delay");
    el.style.animationDelay = "-0.075s";
    clearInlineAnimation(el);
    expect(el.style.animationTimingFunction).toBe("");
    expect(el.style.animationDelay).toBe("");
  });

  it("an owner-scoped clear releases only that writer's stake", () => {
    // Two independent drivers on one element (a swipe settle and the engine's
    // player both driving a shared bar's transform): the one that finishes
    // first must NOT restore the original out from under the other.
    const swipe = Symbol("swipe");
    const player = Symbol("player");
    el.style.transform = "translateX(1px)"; // consumer original
    trackInlineWrite(el, "transform", swipe);
    trackInlineWrite(el, "transform", player);
    el.style.transform = "translateX(120px)"; // mid-animation value

    clearInlineAnimation(el, undefined, swipe);
    // The player still drives: the inline value must survive.
    expect(el.style.transform).toBe("translateX(120px)");

    clearInlineAnimation(el, undefined, player);
    // Last stake gone → the consumer's original is restored.
    expect(el.style.transform).toBe("translateX(1px)");
  });

  it("an owner-scoped clear never strips properties it has no stake in", () => {
    const stranger = Symbol("stranger");
    trackInlineWrite(el, "transform"); // global writer's stake
    el.style.transform = "translateX(50px)";
    el.style.opacity = "0.5"; // untracked consumer value
    clearInlineAnimation(el, undefined, stranger);
    expect(el.style.transform).toBe("translateX(50px)"); // other writer's, kept
    expect(el.style.opacity).toBe("0.5"); // untracked, kept (no force fallback)
  });

  it("the inline transition reset is scoped to its last writer", async () => {
    const A = Symbol("writer-A");
    const B = Symbol("writer-B");
    // B's instant write pins transition: "none" under B's ownership.
    await animateInline(el, { x: 10 }, {}, B);
    expect(el.style.transition).toBe("none");
    // A's cleanup must not clip it...
    clearInlineAnimation(el, undefined, A);
    expect(el.style.transition).toBe("none");
    // ...B's own (or force) does.
    clearInlineAnimation(el, undefined, B);
    expect(el.style.transition).toBe("");
  });

  it("a force clear (no owner) remains the final authority over every stake", () => {
    const swipe = Symbol("swipe");
    trackInlineWrite(el, "transform", swipe);
    el.style.transform = "translateX(80px)";
    clearInlineAnimation(el); // the COMPLETED flip: flight is over
    expect(el.style.transform).toBe("");
  });
});
