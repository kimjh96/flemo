// A CSS animation belongs to an element's PLACE in the document. Take the node
// out of the tree and every animation on it is canceled; put it back and they
// start over from zero.
//
// A flight does exactly that, twice: the real element is hoisted into the morph
// layer when it leaves, and returned to its slot when it lands. Whatever the
// consumer put INSIDE that element comes along for the ride — a `<Part>`, a
// spinner, a fade of their own — and every one of those replays on landing, a
// beat after it had already finished. Which reads as the content blinking out
// and coming back at the exact moment the morph settles.
//
// So the clocks travel with the node. Before the move each descendant
// animation's time is recorded; after it, the same animation is seeked back to
// where it was. A finished one lands finished, a paused one stays where the
// hold left it, and one still running picks up mid-stride.

interface SavedTime {
  time: number;
}

// Only CSS animations are addressed here. A script-driven Animation object
// (Web Animations, a motion library) is not bound to the element's presence in
// the document the same way, and is left alone.
function animationName(animation: Animation): string | null {
  const name = (animation as unknown as { animationName?: unknown }).animationName;
  return typeof name === "string" && name.length > 0 ? name : null;
}

// `AnimationEffect` has no `target` in the DOM lib — it is on `KeyframeEffect`,
// which is what every CSS animation's effect actually is.
function targetOf(animation: Animation): Element | null {
  const effect = animation.effect as KeyframeEffect | null;
  const target = effect?.target ?? null;
  return target instanceof Element ? target : null;
}

function currentTimeOf(animation: Animation): number | null {
  const time = animation.currentTime;
  return typeof time === "number" ? time : null;
}

// The key has to survive the move, so it cannot be the element itself in every
// case — a clone is a different node. Document order inside the subtree plus
// the animation's name identifies it: the tree is not being rewritten by the
// move, only re-parented.
function indexOf(root: Element): Map<Element, number> {
  const index = new Map<Element, number>();
  index.set(root, 0);
  let next = 1;
  for (const node of root.querySelectorAll("*")) index.set(node, next++);
  return index;
}

function collect(root: Element): Map<string, SavedTime> {
  const saved = new Map<string, SavedTime>();
  if (typeof root.getAnimations !== "function") return saved;

  const index = indexOf(root);
  for (const animation of root.getAnimations({ subtree: true })) {
    const target = targetOf(animation);
    // The root's own animations are the morph's — the runtime writes those
    // itself on both sides of the move and must stay their only author.
    if (!target || target === root) continue;
    const name = animationName(animation);
    const position = index.get(target);
    if (name === null || position === undefined) continue;
    const time = currentTimeOf(animation);
    if (time === null) continue;
    saved.set(`${position}|${name}`, { time });
  }
  return saved;
}

// Runs `move` — the re-parent — and carries the subtree's animation clocks
// across it.
export function preserveDescendantAnimations(root: Element, move: () => void): void {
  const saved = collect(root);
  move();
  if (saved.size === 0 || typeof root.getAnimations !== "function") return;

  const index = indexOf(root);
  for (const animation of root.getAnimations({ subtree: true })) {
    const target = targetOf(animation);
    if (!target || target === root) continue;
    const name = animationName(animation);
    const position = index.get(target);
    if (name === null || position === undefined) continue;
    const previous = saved.get(`${position}|${name}`);
    if (!previous) continue;
    try {
      animation.currentTime = previous.time;
    } catch {
      // A seek can be refused (an animation with no resolved timeline yet).
      // Restarting is the wrong result but not a broken one, so it stands.
    }
  }
}

export default preserveDescendantAnimations;
