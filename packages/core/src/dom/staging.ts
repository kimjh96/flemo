// MOVING AN ELEMENT INTO A STAGING LAYER.
//
// flemo lifts elements out of their screens twice, for the same reason and by
// the same means. A morph's shared element travels in the flight layer (see
// @morph/morphLayer); a matched shared bar's <Part> cross-fades in the part
// layer (see @screen/partLayer). A screen clips its descendants, covers what it
// replaces, and drags its contents along when it slides — all three are
// properties of being a DESCENDANT, so for the flight the element stops being
// one.
//
// What both moves need is here, once. It lives in @dom because the two callers
// sit on opposite sides of a dependency edge: @morph already imports
// @core/engine, so an engine-driven staging runtime cannot reach back into
// @morph without closing a cycle.

export interface StagingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A viewport rect in a staging layer's own coordinates.
 *
 * The layer can sit inside a transformed ancestor (a demo bezel, a scaled
 * preview), in which case a px it is positioned by is not a px on the glass.
 * Its measured rect against its laid-out size gives the ratio, so a flight is
 * expressed in the space it is actually staged in.
 */
export const intoLayerSpace = (rect: StagingRect, layer: HTMLElement): StagingRect => {
  const box = layer.getBoundingClientRect();
  const scaleX = layer.offsetWidth > 0 ? box.width / layer.offsetWidth || 1 : 1;
  const scaleY = layer.offsetHeight > 0 ? box.height / layer.offsetHeight || 1 : 1;
  return {
    x: (rect.x - box.left) / scaleX,
    y: (rect.y - box.top) / scaleY,
    width: rect.width / scaleX,
    height: rect.height / scaleY
  };
};

// A CSS animation belongs to an element's PLACE in the document. Take the node
// out of the tree and every animation on it is canceled; put it back and they
// start over from zero.
//
// A flight does exactly that, twice: the real element is hoisted into its
// staging layer when it leaves, and returned when it lands. Whatever the
// consumer put INSIDE that element comes along for the ride — a `<Part>`, a
// spinner, a fade of their own — and every one of those replays on landing, a
// beat after it had already finished. Which reads as the content blinking out
// and coming back at the exact moment the flight settles.
//
// So the clocks travel with the node. Before the move each animation's time is
// recorded; after it, the same animation is seeked back to where it was. A
// finished one lands finished, a paused one stays where the hold left it, and
// one still running picks up mid-stride.

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

function collect(root: Element, includeRoot: boolean): Map<string, SavedTime> {
  const saved = new Map<string, SavedTime>();
  if (typeof root.getAnimations !== "function") return saved;

  const index = indexOf(root);
  for (const animation of root.getAnimations({ subtree: true })) {
    const target = targetOf(animation);
    if (!target) continue;
    if (target === root && !includeRoot) continue;
    const name = animationName(animation);
    const position = index.get(target);
    if (name === null || position === undefined) continue;
    const time = currentTimeOf(animation);
    if (time === null) continue;
    saved.set(`${position}|${name}`, { time });
  }
  return saved;
}

export interface PreserveAnimationsOptions {
  /**
   * Carry the root element's OWN animations across the move too.
   *
   * Off by default, which is what a morph needs: the runtime writes the root's
   * animation itself on both sides of the move and must stay its only author.
   * A staged `<Part>` is the opposite case — the compiled part rule animates the
   * part element itself, and that rule matches on name/status/active with no
   * structural term, so the move restarts the very animation the flight is
   * being watched for.
   */
  includeRoot?: boolean;
}

/**
 * Runs `move` — the re-parent — and carries the subtree's animation clocks
 * across it.
 */
export function preserveAnimations(
  root: Element,
  move: () => void,
  options: PreserveAnimationsOptions = {}
): void {
  const includeRoot = options.includeRoot ?? false;
  const saved = collect(root, includeRoot);
  move();
  if (saved.size === 0 || typeof root.getAnimations !== "function") return;

  const index = indexOf(root);
  for (const animation of root.getAnimations({ subtree: true })) {
    const target = targetOf(animation);
    if (!target) continue;
    if (target === root && !includeRoot) continue;
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
