// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

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
