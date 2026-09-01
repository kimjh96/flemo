import { expectAnimationCancel } from "@core/engine/cancelResume";
import {
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  attrSelector,
  BAR_RIDING_ATTR,
  PART_HOME_ATTR,
  PART_NAME_ATTR,
  PART_STAND_IN_ATTR,
  SCREEN_ATTR
} from "@dom/attributes";

import { intoLayerSpace, preserveAnimations } from "@dom/staging";

// CROSS-FADING A SHARED BAR'S PARTS.
//
// Two screens that declare the same `sharedTopBarId` each render their OWN copy
// of that bar, inside their own screen container. The bars are then non-riding
// (computeBarRiding): neither moves, so the chrome appears to hand over
// seamlessly while the screens animate underneath. That is right for the bar's
// background, its title, its progress — anything meant to sit still.
//
// It is wrong for a <Part>. A part is the piece of the bar that is SUPPOSED to
// change across the flight (a close icon becoming a back chevron), and a
// cross-fade needs both sides visible at once. They are not: a screen container
// is an isolated stacking context carrying the screen's z-index, so the lower
// screen's bar — parts and all — is painted under the upper screen's opaque
// surface. Both parts receive the right status and run the right keyframes, and
// exactly one of them is ever seen. On a pop it is worse than invisible: the
// returning part finishes its enter animation while occluded and then appears,
// un-transitioned, at the moment the departing screen is released.
//
// So the covered side's parts leave. For the duration of the flight they are
// staged in the Router's part layer, above both screens, at the rect they
// occupied — and then they go home exactly as they were.
//
// WHICH SIDE IS COVERED is not a guess: it is the PASSIVE one, on every status.
// A push covers the previous screen with the entrant; a pop's active screen is
// the departing top (data-flemo-active follows the stack, not the direction), so
// the returning screen is underneath; a replace puts the entrant over the screen
// it replaces. The engine stages the passive side and only the passive side.

/**
 * Above the screens, below a morph.
 *
 * A morph is the focal shared element of a flight — an element the consumer
 * pointed at — and a bar's chrome passing over it would be exactly backwards.
 * The morph layer's own number (see @morph/attachMorph's `prepareLayer`) is the
 * ceiling this sits under.
 */
export const PART_LAYER_LEVEL = 2147482000;

// Who currently owns the hold value written on a layer. A navigation that
// interrupts another mid-flight stages over the top of it, and the interrupted
// flight's release must not then strip the hold out from under the live one.
// Counting the layer's children cannot tell them apart — an interrupting flight
// stages the SAME parts of the SAME bar, so the count matches exactly.
const holdOwners = new WeakMap<HTMLElement, symbol>();

interface StagedPart {
  readonly element: HTMLElement;
  readonly parent: Node;
  readonly nextSibling: Node | null;
  /** The element's own `style` attribute, verbatim, or null when it had none. */
  readonly inlineStyle: string | null;
  /** The box holding the part's place in the bar while it is away. */
  readonly standIn: HTMLElement;
}

// The part's place in the bar, kept while the part itself is up in the layer.
//
// Without it the bar simply loses the part's width and everything after it
// slides over. On a push that happens to the covered screen, where nobody can
// see it; on a pop it happens to the RETURNING screen, whose bar is exactly the
// one left on the glass when the flight lands.
//
// It copies the border-box size and the margins because those are the part's
// whole contribution to its bar's layout, and `flex: 0 0 auto` so a flex bar
// cannot grow or shrink the stand-in into a different size than the part it
// stands for.
const buildStandIn = (element: HTMLElement, rect: DOMRect): HTMLElement => {
  const standIn = element.ownerDocument.createElement("div");
  standIn.setAttribute(PART_STAND_IN_ATTR, "");
  standIn.setAttribute("aria-hidden", "true");
  standIn.style.width = `${rect.width}px`;
  standIn.style.height = `${rect.height}px`;
  standIn.style.flex = "0 0 auto";
  standIn.style.pointerEvents = "none";
  standIn.style.visibility = "hidden";
  const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (computed) {
    standIn.style.marginTop = computed.marginTop;
    standIn.style.marginRight = computed.marginRight;
    standIn.style.marginBottom = computed.marginBottom;
    standIn.style.marginLeft = computed.marginLeft;
  }
  return standIn;
};

export interface StagedBarParts {
  /** Put every staged part back where it came from, exactly as it was. */
  readonly release: () => void;
}

export interface StageBarPartsInput {
  /** The screen scope the parts belong to — the passive side of the flight. */
  readonly scope: HTMLElement;
  /** This screen's shared bars; riding and absent ones are skipped. */
  readonly bars: readonly (HTMLElement | null | undefined)[];
  /** The Router's part layer, from resolvePartLayer. */
  readonly layer: HTMLElement | null;
  /**
   * How long to wait before releasing a staging nothing came back for.
   *
   * A screen that is still transitional when it goes away — an aborted
   * navigation, a replace that unmounts the side it replaced — never runs the
   * COMPLETED drive that would return its parts, and a part left in the layer
   * is a stale icon floating over the app for the rest of the session. The
   * caller passes this flight's choreography span plus its own slack, so a
   * long-authored part is never cut short by the backstop.
   */
  readonly strandedMs: number;
}

// What the runtime insists on, wherever the binding put the box: the layer
// takes no pointer input (an empty full-size box would otherwise swallow every
// tap meant for the screen under it) and outranks the screens it stages over.
// Idempotent, so re-staging costs nothing.
const prepareLayer = (layer: HTMLElement): void => {
  layer.style.pointerEvents = "none";
  layer.style.zIndex = String(PART_LAYER_LEVEL);
};

// The parts of the bars this screen hands over rather than carries. A RIDING bar
// travels with its screen because the partner does not own it — there is no
// second copy to cross-fade with, and lifting its parts out of the motion
// carrying them would strand them mid-air.
const matchedBarParts = (bars: StageBarPartsInput["bars"]): HTMLElement[] => {
  const parts: HTMLElement[] = [];
  for (const bar of bars) {
    if (!bar) continue;
    if (bar.getAttribute(BAR_RIDING_ATTR) !== "false") continue;
    parts.push(...bar.querySelectorAll<HTMLElement>(attrSelector(PART_NAME_ATTR)));
  }
  return parts;
};

/**
 * Lift this screen's matched-bar parts into the Router's part layer for the
 * flight. Returns null when there is nothing to stage — no layer, no screen
 * identity, or no part in a matched bar — so a flight that needs none of this
 * pays for none of it.
 */
export const stageBarParts = (input: StageBarPartsInput): StagedBarParts | null => {
  const { scope, bars, layer, strandedMs } = input;
  if (!layer) return null;

  const screenId = scope.getAttribute(SCREEN_ATTR);
  // The home marker is what keeps a staged part inside its screen's participant
  // set (see flightParticipants.collectScreenParts). Without an identity to
  // stamp, staging would silently drop the part out of the layer pin and the
  // COMPLETED inline clear, so it does not happen at all.
  if (screenId === null) return null;

  const candidates = matchedBarParts(bars);
  if (candidates.length === 0) return null;

  prepareLayer(layer);

  const staged: StagedPart[] = [];
  for (const element of candidates) {
    // Every candidate came out of a bar's own querySelectorAll, so it is a
    // descendant of something by construction and this cannot be null.
    const parent = element.parentNode!;

    const rect = element.getBoundingClientRect();
    // NEVER STAGE WHAT CANNOT BE MEASURED.
    //
    // A covered screen is Activity-hidden once its flight settles, and hidden
    // means `display: none`: every rect inside it reads 0,0 0x0. Pinning a part
    // at that measurement puts it at the layer's ORIGIN with no size — observed
    // on a real swipe as the returning screen's icon and badge drawn clipped in
    // the top-left corner, nowhere near the bar they belong to.
    //
    // There is nothing to do about it here. A part that has no box has no place
    // to be staged AT, so it stays home and keeps the behaviour it had before
    // any of this: covered, but correct.
    if (rect.width <= 0 || rect.height <= 0) continue;
    const box = intoLayerSpace(rect, layer);
    const standIn = buildStandIn(element, rect);
    const entry: StagedPart = {
      element,
      parent,
      nextSibling: element.nextSibling,
      inlineStyle: element.getAttribute("style"),
      standIn
    };
    // In place BEFORE the move, so the bar never lays out without one or the
    // other and no frame can be painted a part narrower than it is at rest.
    parent.insertBefore(standIn, element);

    // The compiled part rule matches on name + status + active with NO
    // structural term, so the move does not stop the animation from applying —
    // it restarts it, because a CSS animation belongs to the element's place in
    // the document. `includeRoot` carries the part's OWN clock across, which is
    // the one the flight is being watched for, and the mark tells cancel-resume
    // the cancel this causes is ours and already answered — its own recovery
    // writes a negative inline `animation-delay` that would erase the part's
    // AUTHORED one.
    expectAnimationCancel(element);
    preserveAnimations(element, () => layer.appendChild(element), { includeRoot: true });

    element.setAttribute(PART_HOME_ATTR, screenId);
    element.style.position = "absolute";
    element.style.left = `${box.x}px`;
    element.style.top = `${box.y}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
    // getBoundingClientRect measures the BORDER box, so the staged copy has to
    // be sized as one; margins would offset a box that is already positioned.
    element.style.boxSizing = "border-box";
    element.style.margin = "0";

    staged.push(entry);
  }

  // Every candidate was unmeasurable. Nothing was moved, so there is nothing to
  // give back.
  if (staged.length === 0) return null;

  // The layer is outside the screen, so the compiled hold rule cannot reach a
  // staged part through it. Mirroring the owning screen's hold attribute onto
  // the LAYER puts the parts back under the same pause (the rule pauses a held
  // element and its `[data-flemo-part-name]` descendants alike), which is what
  // keeps them starting on the same frame as the flight instead of on a clock
  // of their own — the defect the decorator once had, and the reason
  // collectUnheldOuterParts exists at all.
  //
  // Mirroring onto the layer rather than onto each part is also what keeps this
  // out of the ACTIVE side's way: that sweep looks for parts carrying the
  // attribute THEMSELVES, and a part held through an ancestor is excluded from
  // both its stamp and its clear. One owner, no flapping.
  const mirrorHold = () => {
    layer.setAttribute(ANIM_HOLD_ATTR, scope.getAttribute(ANIM_HOLD_ATTR) ?? ANIM_HOLD.RELEASED);
  };
  mirrorHold();
  const token = Symbol("bar-part-staging");
  holdOwners.set(layer, token);
  const holdWatch =
    typeof MutationObserver === "function" ? new MutationObserver(mirrorHold) : null;
  holdWatch?.observe(scope, { attributes: true, attributeFilter: [ANIM_HOLD_ATTR] });

  let released = false;
  const release = () => {
    /* v8 ignore next -- the flight's end and an interrupting navigation race;
       whichever arrives second must not restore the parts twice. */
    if (released) return;
    released = true;
    clearTimeout(stranded);
    holdWatch?.disconnect();
    // Only if this staging is still the one holding the layer.
    if (holdOwners.get(layer) === token) {
      holdOwners.delete(layer);
      layer.removeAttribute(ANIM_HOLD_ATTR);
    }

    for (const entry of staged) {
      entry.element.removeAttribute(PART_HOME_ATTR);
      // Home again, and exactly as it was: the part carries no trace of the
      // flight, so what the consumer laid out is what remains.
      if (entry.inlineStyle === null) entry.element.removeAttribute("style");
      else entry.element.setAttribute("style", entry.inlineStyle);

      // The screen may have gone while its parts were up here — a pop's
      // departing screen unmounts on landing. There is nothing to return to.
      if (!entry.parent.isConnected) {
        entry.element.remove();
        entry.standIn.remove();
        continue;
      }
      // Into the stand-in's place, not next to it: the consumer may have
      // re-rendered the bar while the part was away, and the stand-in is the
      // one node that has been holding the part's position through whatever
      // else moved. It is swapped rather than removed first, so the bar is
      // never laid out missing both.
      expectAnimationCancel(entry.element);
      preserveAnimations(
        entry.element,
        () => {
          if (entry.standIn.isConnected) entry.standIn.replaceWith(entry.element);
          else entry.parent.insertBefore(entry.element, entry.nextSibling);
        },
        { includeRoot: true }
      );
      entry.standIn.remove();
    }
  };

  const stranded = setTimeout(release, strandedMs);

  return { release };
};
