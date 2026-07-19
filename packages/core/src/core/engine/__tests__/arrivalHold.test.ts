// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import createArrivalHold, { HELD_ARRIVAL_ATTR } from "@core/engine/arrivalHold";

// MutationObserver delivers on a microtask checkpoint; a macrotask hop is the
// portable way to await it (covers the observer's own follow-up records too).
const observerFlush = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildScreen = () => {
  const scope = document.createElement("div");
  const section = document.createElement("section");
  const skeleton = document.createElement("div");
  skeleton.className = "skeleton";
  const trailing = document.createElement("footer");
  section.appendChild(skeleton);
  section.appendChild(trailing);
  scope.appendChild(section);
  document.body.appendChild(scope);
  return { scope, section, skeleton, trailing };
};

describe("createArrivalHold", () => {
  it("degrades to a noop where MutationObserver is unavailable (SSR)", () => {
    const original = globalThis.MutationObserver;
    vi.stubGlobal("MutationObserver", undefined);
    try {
      const scope = document.createElement("div");
      const release = createArrivalHold(scope);
      expect(() => release()).not.toThrow();
    } finally {
      vi.stubGlobal("MutationObserver", original);
    }
  });

  it("keeps a held arrival's lazy images LOADING off-glass and restores the attribute at the landing", async () => {
    // REGRESSION: `display: none` stops a lazy image's load entirely (no
    // viewport intersection), so the landing's one-commit reveal used to push
    // every image into the viewport at once — dozens of cache-warm loads and
    // layouts synchronized into a single ~370ms main-thread task right where
    // the user's next tap lands. The hold defers visibility, never loading.
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const arrival = document.createElement("div");
    const lazyImage = document.createElement("img");
    lazyImage.setAttribute("loading", "lazy");
    const decode = vi.fn(() => Promise.resolve());
    (lazyImage as unknown as { decode: () => Promise<void> }).decode = decode;
    Object.defineProperty(lazyImage, "complete", { value: true, configurable: true });
    const eagerImage = document.createElement("img");
    eagerImage.setAttribute("loading", "eager");
    arrival.append(lazyImage, eagerImage);
    section.replaceChild(arrival, skeleton);
    await observerFlush();

    // Held off-glass, but fetching and decoding as if visible.
    expect(arrival.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);
    expect(lazyImage.getAttribute("loading")).toBe("eager");
    expect(decode).toHaveBeenCalledTimes(1);
    // An authored-eager image is left alone.
    expect(eagerImage.getAttribute("loading")).toBe("eager");

    release();
    // The authored attribute comes back in the landing commit.
    expect(lazyImage.getAttribute("loading")).toBe("lazy");
    expect(arrival.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);
    scope.remove();
  });

  it("prepareLanding decodes every held image off-main before the reveal", async () => {
    // WebKit paints an undecoded image by synchronously decoding the FULL
    // original on the main thread (profiled: RenderImage::paint → AppleJPEG,
    // ~380ms for one production list's photos). The landing decodes first,
    // bounded, so the reveal frame never carries that work.
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const arrival = document.createElement("div");
    const image = document.createElement("img");
    image.setAttribute("loading", "eager");
    const decode = vi.fn(() => Promise.resolve());
    (image as unknown as { decode: () => Promise<void> }).decode = decode;
    Object.defineProperty(image, "complete", { value: true, configurable: true });
    arrival.appendChild(image);
    section.replaceChild(arrival, skeleton);
    await observerFlush();
    decode.mockClear(); // the hold-time warm-up decode is separate

    await release.prepareLanding();
    expect(decode).toHaveBeenCalledTimes(1);
    release();
    scope.remove();
  });

  it("prepareLanding resolves immediately with nothing decodable held", async () => {
    const { scope } = buildScreen();
    const release = createArrivalHold(scope);
    await expect(release.prepareLanding()).resolves.toBeUndefined();
    release();
    scope.remove();
  });

  it("decodes a held lazy image once its pending load completes", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const arrival = document.createElement("img");
    arrival.setAttribute("loading", "lazy");
    const decode = vi.fn(() => Promise.resolve());
    (arrival as unknown as { decode: () => Promise<void> }).decode = decode;
    Object.defineProperty(arrival, "complete", { value: false, configurable: true });
    section.replaceChild(arrival, skeleton);
    await observerFlush();

    expect(arrival.getAttribute("loading")).toBe("eager");
    expect(decode).not.toHaveBeenCalled();
    arrival.dispatchEvent(new Event("load"));
    expect(decode).toHaveBeenCalledTimes(1);

    release();
    scope.remove();
  });

  it("ignores comment-node removals inside a swap batch", async () => {
    const { scope, section, skeleton } = buildScreen();
    const comment = document.createComment("marker");
    section.appendChild(comment);
    const release = createArrivalHold(scope);

    const content = document.createElement("article");
    section.removeChild(comment);
    section.replaceChild(content, skeleton);
    await observerFlush();

    // The comment is neither Element nor Text: never parked.
    expect(comment.parentNode).toBe(null);
    expect(skeleton.parentNode).toBe(section);
    release();
    scope.remove();
  });

  it("treats a same-value in-place write as glass-neutral", async () => {
    const { scope, section } = buildScreen();
    const label = document.createElement("span");
    label.textContent = "same";
    section.appendChild(label);
    const release = createArrivalHold(scope);

    label.firstChild!.nodeValue = "same";
    await observerFlush();
    expect(label.textContent).toBe("same");

    release();
    expect(label.textContent).toBe("same");
    scope.remove();
  });

  it("reverts a freshly ADDED attribute and replays it at release", async () => {
    const { scope, section } = buildScreen();
    const chip = document.createElement("div");
    section.appendChild(chip);
    const release = createArrivalHold(scope);

    chip.setAttribute("aria-busy", "true");
    await observerFlush();
    // On glass the attribute never existed mid-flight.
    expect(chip.hasAttribute("aria-busy")).toBe(false);

    release();
    expect(chip.getAttribute("aria-busy")).toBe("true");
    scope.remove();
  });

  it("reverts a mid-flight attribute REMOVAL and replays it at release", async () => {
    const { scope, section } = buildScreen();
    const chip = document.createElement("div");
    chip.setAttribute("aria-label", "kept");
    section.appendChild(chip);
    const release = createArrivalHold(scope);

    chip.removeAttribute("aria-label");
    await observerFlush();
    expect(chip.getAttribute("aria-label")).toBe("kept");

    release();
    expect(chip.hasAttribute("aria-label")).toBe(false);
    scope.remove();
  });

  it("freezes multiple attributes of one element in one batch", async () => {
    const { scope, section } = buildScreen();
    const chip = document.createElement("div");
    chip.className = "a";
    chip.setAttribute("aria-label", "one");
    section.appendChild(chip);
    const release = createArrivalHold(scope);

    chip.className = "b";
    chip.setAttribute("aria-label", "two");
    await observerFlush();
    expect(chip.className).toBe("a");
    expect(chip.getAttribute("aria-label")).toBe("one");

    release();
    expect(chip.className).toBe("b");
    expect(chip.getAttribute("aria-label")).toBe("two");
    scope.remove();
  });

  it("skips in-place freezing for elements detached within the batch", async () => {
    const { scope, section } = buildScreen();
    const chip = document.createElement("div");
    chip.className = "a";
    section.appendChild(chip);
    const release = createArrivalHold(scope);

    chip.className = "b";
    chip.remove();
    await observerFlush();
    // Detached before delivery: nothing to keep on glass.
    expect(chip.className).toBe("b");
    release();
    scope.remove();
  });

  it("never re-parks a parked departure removed by a third party", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const content = document.createElement("article");
    section.replaceChild(content, skeleton);
    await observerFlush();
    expect(skeleton.parentNode).toBe(section);

    // Something outside the hold rips the zombie out: it must stay out.
    section.removeChild(skeleton);
    await observerFlush();
    expect(skeleton.parentNode).toBe(null);

    release();
    scope.remove();
  });

  it("release tolerates frozen elements that left the tree", async () => {
    const { scope, section } = buildScreen();
    const label = document.createElement("span");
    label.textContent = "a";
    const chip = document.createElement("div");
    chip.className = "x";
    section.appendChild(label);
    section.appendChild(chip);
    const release = createArrivalHold(scope);

    label.firstChild!.nodeValue = "b";
    chip.className = "y";
    await observerFlush();
    label.remove();
    chip.remove();
    await observerFlush();

    expect(() => release()).not.toThrow();
    scope.remove();
  });

  it("parks a mid-flight swap in place and reflects it in one commit on release", async () => {
    const { scope, section, skeleton, trailing } = buildScreen();
    const release = createArrivalHold(scope);

    const content = document.createElement("article");
    section.replaceChild(content, skeleton);
    await observerFlush();

    // On glass nothing changed: the departed skeleton is back — anchored to
    // the held arrival's exact position, ahead of the trailing sibling — and
    // the arrival carries the hold attribute (display: none via the sheet).
    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);
    expect(skeleton.parentNode).toBe(section);
    expect(skeleton.nextSibling).toBe(content);
    expect(content.nextSibling).toBe(trailing);

    release();

    // One commit at rest: skeleton gone, arrival revealed.
    expect(skeleton.parentNode).toBe(null);
    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);
    expect(content.parentNode).toBe(section);
    scope.remove();
  });

  it("parks split remove+insert records of one batch as a single swap", async () => {
    const { scope, section, skeleton, trailing } = buildScreen();
    const release = createArrivalHold(scope);

    // React's commit order: deletions first, insertions after — separate
    // records, one microtask batch.
    const content = document.createElement("article");
    section.removeChild(skeleton);
    section.insertBefore(content, trailing);
    await observerFlush();

    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);
    expect(skeleton.parentNode).toBe(section);
    expect(skeleton.nextSibling).toBe(content);

    release();
    expect(skeleton.parentNode).toBe(null);
    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);
    scope.remove();
  });

  it("reflects removal-only mutations live (a closing overlay must close)", async () => {
    const { scope, section } = buildScreen();
    const overlay = document.createElement("div");
    overlay.className = "backdrop";
    scope.appendChild(overlay);
    const release = createArrivalHold(scope);

    scope.removeChild(overlay);
    await observerFlush();

    // Not a swap: nothing added on that parent in the batch. The overlay
    // stays gone instead of haunting the moving screen.
    expect(overlay.parentNode).toBe(null);

    release();
    expect(section.parentNode).toBe(scope);
    scope.remove();
  });

  it("holds addition-only mutations without parking anything", async () => {
    const { scope, section } = buildScreen();
    const release = createArrivalHold(scope);

    const streamed = document.createElement("article");
    section.appendChild(streamed);
    await observerFlush();
    expect(streamed.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);

    release();
    expect(streamed.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);
    scope.remove();
  });

  it("does not re-hold its own parked re-insertions", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const content = document.createElement("article");
    section.replaceChild(content, skeleton);
    await observerFlush();
    await observerFlush();

    // The parked departure must never be treated as a consumer arrival.
    expect(skeleton.parentNode).toBe(section);
    expect(skeleton.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);

    release();
    expect(skeleton.parentNode).toBe(null);
    scope.remove();
  });

  it("drops a held arrival that is replaced again before landing", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const first = document.createElement("article");
    section.replaceChild(first, skeleton);
    await observerFlush();

    const second = document.createElement("article");
    section.replaceChild(second, first);
    await observerFlush();

    // `first` was never visible: it leaves tracking without being parked.
    expect(first.parentNode).toBe(null);
    expect(first.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);
    expect(second.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);
    expect(skeleton.parentNode).toBe(section);

    release();
    expect(skeleton.parentNode).toBe(null);
    expect(second.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);
    scope.remove();
  });

  it("parks departed text nodes that are part of a swap", async () => {
    const { scope, section, trailing } = buildScreen();
    const text = document.createTextNode("loading");
    section.insertBefore(text, trailing);
    const release = createArrivalHold(scope);

    const content = document.createElement("article");
    section.removeChild(text);
    section.insertBefore(content, trailing);
    await observerFlush();

    expect(text.parentNode).toBe(section);
    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);

    release();
    expect(text.parentNode).toBe(null);
    scope.remove();
  });

  it("release survives swaps whose region already left the tree", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const content = document.createElement("article");
    section.replaceChild(content, skeleton);
    await observerFlush();
    expect(skeleton.parentNode).toBe(section);

    // The whole section unmounts mid-flight: parked node goes with it.
    scope.removeChild(section);
    await observerFlush();

    expect(() => release()).not.toThrow();
    scope.remove();
  });

  it("parks a trailing removal-only batch when the parent already holds an arrival", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    // Stage 1: content arrives (held). React's staged Suspense reveal removes
    // the fallback a commit LATER, as a removal-only batch.
    const content = document.createElement("article");
    section.insertBefore(content, skeleton);
    await observerFlush();
    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);

    section.removeChild(skeleton);
    await observerFlush();

    // The fallback stays on glass: its parent holds an invisible arrival, so
    // this removal is part of the staged swap, not a closing overlay.
    expect(skeleton.parentNode).toBe(section);

    release();
    expect(skeleton.parentNode).toBe(null);
    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(false);
    scope.remove();
  });

  it("reverts an in-place text write mid-flight and replays it at release", async () => {
    const { scope, section } = buildScreen();
    const label = document.createElement("span");
    label.textContent = "63";
    section.appendChild(label);
    const release = createArrivalHold(scope);

    label.firstChild!.nodeValue = "64";
    await observerFlush();
    // On glass the pre-flight value survives the whole flight.
    expect(label.textContent).toBe("63");

    label.firstChild!.nodeValue = "65";
    await observerFlush();
    expect(label.textContent).toBe("63");

    release();
    // The release converges on what React last wrote.
    expect(label.textContent).toBe("65");
    scope.remove();
  });

  it("keeps glass stable across multiple same-batch writes and echoes", async () => {
    const { scope, section } = buildScreen();
    const label = document.createElement("span");
    label.textContent = "A";
    section.appendChild(label);
    const release = createArrivalHold(scope);

    // Two writes in ONE batch: the echo of the revert must not be mistaken
    // for a consumer write on the next delivery.
    label.firstChild!.nodeValue = "B";
    label.firstChild!.nodeValue = "C";
    await observerFlush();
    expect(label.textContent).toBe("A");
    await observerFlush();
    expect(label.textContent).toBe("A");

    release();
    expect(label.textContent).toBe("C");
    scope.remove();
  });

  it("reverts and replays attribute writes, letting data-flemo-* flow live", async () => {
    const { scope, section } = buildScreen();
    const chip = document.createElement("div");
    chip.className = "idle";
    section.appendChild(chip);
    const release = createArrivalHold(scope);

    chip.className = "active";
    chip.setAttribute("data-flemo-status", "PUSHING");
    await observerFlush();
    expect(chip.className).toBe("idle");
    expect(chip.getAttribute("data-flemo-status")).toBe("PUSHING");

    release();
    expect(chip.className).toBe("active");
    scope.remove();
  });

  it("keeps the latest value when a consumer converges back to the glass value", async () => {
    const { scope, section } = buildScreen();
    const label = document.createElement("span");
    label.textContent = "A";
    section.appendChild(label);
    const release = createArrivalHold(scope);

    label.firstChild!.nodeValue = "B";
    await observerFlush();
    await observerFlush();
    label.firstChild!.nodeValue = "A";
    await observerFlush();
    await observerFlush();

    release();
    expect(label.textContent).toBe("A");
    scope.remove();
  });

  it("exempts the scope element and <Part> elements from the in-place freeze", async () => {
    const { scope, section } = buildScreen();
    const part = document.createElement("div");
    part.setAttribute("data-flemo-part-name", "bar");
    const partLabel = document.createElement("span");
    partLabel.textContent = "p1";
    part.appendChild(partLabel);
    section.appendChild(part);
    const release = createArrivalHold(scope);

    scope.setAttribute("style", "transform: none");
    partLabel.firstChild!.nodeValue = "p2";
    await observerFlush();
    expect(scope.getAttribute("style")).toBe("transform: none");
    expect(part.textContent).toBe("p2");

    release();
    scope.remove();
  });

  it("lets a held arrival's subtree mutate freely (it is invisible anyway)", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    const content = document.createElement("article");
    const inner = document.createElement("span");
    inner.textContent = "v1";
    content.appendChild(inner);
    section.replaceChild(content, skeleton);
    await observerFlush();
    expect(content.hasAttribute(HELD_ARRIVAL_ATTR)).toBe(true);

    inner.firstChild!.nodeValue = "v2";
    await observerFlush();
    expect(inner.textContent).toBe("v2");

    release();
    expect(inner.textContent).toBe("v2");
    scope.remove();
  });

  it("skips parking a swap whose target detached within the same batch", async () => {
    const { scope, section, skeleton } = buildScreen();
    const release = createArrivalHold(scope);

    // Swap + ancestor removal in one batch: the child-level swap must not be
    // re-parked into the disconnected subtree; the section's own removal is
    // removal-only at scope level and reflects live.
    const content = document.createElement("article");
    section.replaceChild(content, skeleton);
    scope.removeChild(section);
    await observerFlush();

    expect(skeleton.parentNode).toBe(null);
    release();
    scope.remove();
  });
});
