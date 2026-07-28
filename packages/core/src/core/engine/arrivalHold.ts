// In-flight commit hold: no visible content change while a screen is in
// motion.
//
// A cold navigation routinely carries async data commits — Suspense
// boundaries resolving 200-500ms after the tap, refetches re-rendering a
// just-unfrozen pop destination — which land MID-FLIGHT while the screen is
// still decelerating. Measured on device-emulated Chrome: zero dropped
// frames, zero layout shifts, yet the mid-flight content changes read
// unmistakably as stutter. The library owns the fix the same way it owns
// every pipeline collision: relocate the visible event into a window where
// it cannot collide with motion. Three mutation classes are held:
//
// - SWAPS (childList remove+insert on one parent in one batch): departing
//   nodes are parked back in their spot (React has already disowned them, so
//   re-inserting is safe and the release removes them); arriving nodes are
//   held invisible by the compiled `[data-flemo-held-arrival]` rule. What
//   counts as a swap is deliberately narrow — a removal-only mutation (a
//   closing overlay, a dismissed sheet) is a semantic disappearance and
//   reflects live; resurrecting those paints ghost UI over the moving screen.
// - ADDITIONS: always safe to hold invisible.
// - IN-PLACE WRITES (characterData / attributes on existing nodes): reverted
//   to their on-glass value inside the observer microtask — before paint, so
//   the write never presents — and replayed at release. React never reads
//   the DOM back for reconciliation, so the revert is invisible to it and
//   the release converges on what React last wrote.
//
// The release — at COMPLETED, or the instant the transition is interrupted —
// reflects everything in ONE commit: the same events, the same content, just
// never during motion. This is the shipped "delayed-but-complete" contract
// (the transition gate for heavy mounts) extended from mount time to flight
// time.
//
// Exempt from the freeze, on purpose: the scope element itself and <Part>
// elements (flemo's own runtime writes live there), `data-flemo-*`
// attributes anywhere, and anything inside a held arrival (already
// invisible; freezing its construction would be wasted work).

export const HELD_ARRIVAL_ATTR = "data-flemo-held-arrival";

interface TargetBatch {
  // Departure candidates in removal order (Element or Text).
  removed: Node[];
  // Consumer element arrivals of this batch, in insertion order; the first
  // one still in place anchors the parked departures to the swap's exact
  // position, immune to anchor drift across staggered commits.
  added: Element[];
}

// Per-key freeze state for in-place writes. `glass` is what stays presented
// for the whole flight; `latest` is what React believes and what the release
// replays; `pendingEcho` marks that our own revert's mutation record is still
// due, so a delivery showing the glass value again is our echo, not a
// consumer write.
interface FrozenValue {
  glass: string | null;
  latest: string | null;
  pendingEcho: boolean;
}

export default function createArrivalHold(scope: HTMLElement): () => void {
  if (typeof MutationObserver === "undefined") return () => {};

  const heldArrivals = new Set<Element>();
  const parkedDepartures = new Set<Node>();
  // Nodes this module re-inserted itself: their childList records must not be
  // re-processed as consumer arrivals when the observer delivers them.
  const selfInserted = new Set<Node>();
  const textFreeze = new Map<Node, FrozenValue>();
  const attrFreeze = new Map<Element, Map<string, FrozenValue>>();

  // flemo's own write surfaces, and subtrees that are invisible anyway.
  const exemptFromFreeze = (node: Node): boolean => {
    const element = node instanceof Element ? node : node.parentElement;
    if (!element) return true;
    if (element === scope) return true;
    return element.closest(`[data-flemo-part-name], [${HELD_ARRIVAL_ATTR}]`) !== null;
  };

  // One decision per key per delivery (grouped): with N raw records for a key
  // in one batch, only the FIRST carries the pre-delivery on-glass value and
  // only the LIVE value matters — per-record processing cannot tell our own
  // revert echoes apart from consumer writes when they interleave.
  const freezeInPlace = (
    freeze: FrozenValue | undefined,
    firstOldValue: string | null,
    live: string | null,
    write: (value: string | null) => void
  ): FrozenValue | null => {
    if (!freeze) {
      // Same-value write: glass is already right and nothing needs freezing.
      if (live === firstOldValue) return null;
      write(firstOldValue);
      return { glass: firstOldValue, latest: live, pendingEcho: true };
    }
    if (live === freeze.glass) {
      if (freeze.pendingEcho) {
        // Our revert's own record coming back around.
        freeze.pendingEcho = false;
      } else {
        // A consumer genuinely wrote the glass value: React converged on it.
        freeze.latest = live;
      }
      return freeze;
    }
    freeze.latest = live;
    write(freeze.glass);
    freeze.pendingEcho = true;
    return freeze;
  };

  const observer = new MutationObserver((records) => {
    const batches = new Map<Node, TargetBatch>();
    const batchOf = (target: Node) => {
      let batch = batches.get(target);
      if (!batch) batches.set(target, (batch = { removed: [], added: [] }));
      return batch;
    };
    const textFirst = new Map<Node, string | null>();
    const attrFirst = new Map<Element, Map<string, string | null>>();

    for (const record of records) {
      if (record.type === "characterData") {
        const node = record.target;
        if (!node.isConnected || exemptFromFreeze(node)) continue;
        if (!textFirst.has(node)) textFirst.set(node, record.oldValue);
        continue;
      }
      if (record.type === "attributes") {
        const element = record.target as Element;
        const name = record.attributeName!;
        // flemo's own runtime stamps (status, hold, this shield's marker)
        // must always flow.
        if (name.startsWith("data-flemo")) continue;
        if (!element.isConnected || exemptFromFreeze(element)) continue;
        let firsts = attrFirst.get(element);
        if (!firsts) attrFirst.set(element, (firsts = new Map()));
        if (!firsts.has(name)) firsts.set(name, record.oldValue);
        continue;
      }
      if (record.type !== "childList") continue;
      for (const removed of Array.from(record.removedNodes)) {
        // Our own release removed it: not a consumer mutation.
        if (parkedDepartures.has(removed)) continue;
        // A held arrival replaced again before landing: it was never visible,
        // so it simply stops being tracked — nothing changes on glass.
        if (removed instanceof Element && heldArrivals.delete(removed)) {
          removed.removeAttribute(HELD_ARRIVAL_ATTR);
          continue;
        }
        if (removed instanceof Element || removed.nodeType === Node.TEXT_NODE) {
          batchOf(record.target).removed.push(removed);
        }
      }
      for (const added of Array.from(record.addedNodes)) {
        if (selfInserted.delete(added)) continue;
        if (!(added instanceof Element)) continue;
        added.setAttribute(HELD_ARRIVAL_ATTR, "");
        heldArrivals.add(added);
        batchOf(record.target).added.push(added);
      }
    }

    for (const [node, firstOldValue] of textFirst) {
      const next = freezeInPlace(textFreeze.get(node), firstOldValue, node.nodeValue, (value) => {
        node.nodeValue = value;
      });
      if (next) textFreeze.set(node, next);
    }
    for (const [element, firsts] of attrFirst) {
      let frozen = attrFreeze.get(element);
      for (const [name, firstOldValue] of firsts) {
        const next = freezeInPlace(
          frozen?.get(name),
          firstOldValue,
          element.getAttribute(name),
          (value) => {
            if (value === null) element.removeAttribute(name);
            else element.setAttribute(name, value);
          }
        );
        if (next) {
          if (!frozen) attrFreeze.set(element, (frozen = new Map()));
          frozen.set(name, next);
        }
      }
    }

    for (const [target, batch] of batches) {
      if (batch.removed.length === 0) continue;
      // The whole region may itself have left the tree later in the batch
      // (an ancestor swap): its own removal was parked at that level.
      if (!target.isConnected) continue;
      // A removal with nothing arriving in ITS batch is still part of an
      // ongoing staged swap when the parent already holds an invisible
      // arrival: React reveals nested Suspense content in stages, and the
      // fallback's removal can trail the content's insertion by a whole
      // commit (measured: content inserted mid-flight, fallbacks removed
      // ~300ms later in a removal-only batch). A parent with NO held
      // arrival keeps the original rule — that removal is a semantic
      // disappearance (a closing overlay) and reflects live.
      const heldSibling =
        batch.added.find((added) => added.parentNode === target) ??
        Array.from(target.childNodes).find(
          (child) => child instanceof Element && heldArrivals.has(child)
        ) ??
        null;
      if (batch.added.length === 0 && !heldSibling) continue;
      for (const departed of batch.removed) {
        selfInserted.add(departed);
        target.insertBefore(departed, heldSibling as Node | null);
        parkedDepartures.add(departed);
      }
    }
  });

  observer.observe(scope, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true,
    attributes: true,
    attributeOldValue: true
  });

  return () => {
    observer.disconnect();
    for (const parked of parkedDepartures) {
      parked.parentNode?.removeChild(parked);
    }
    parkedDepartures.clear();
    for (const held of heldArrivals) {
      held.removeAttribute(HELD_ARRIVAL_ATTR);
    }
    heldArrivals.clear();
    // Replay the latest in-place values the flight reverted, in this same
    // commit, so the DOM converges on what React last wrote.
    for (const [node, freeze] of textFreeze) {
      if (node.isConnected) node.nodeValue = freeze.latest;
    }
    textFreeze.clear();
    for (const [element, frozen] of attrFreeze) {
      if (!element.isConnected) continue;
      for (const [name, freeze] of frozen) {
        if (freeze.latest === null) element.removeAttribute(name);
        else element.setAttribute(name, freeze.latest);
      }
    }
    attrFreeze.clear();
    selfInserted.clear();
  };
}
