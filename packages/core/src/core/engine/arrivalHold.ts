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

// How long a landing will wait on held images' decodes at most. Decoding is
// off-main-thread; the cap only bounds a pathological set. Mirrors the
// anim-hold's decode cap (see animStartAnchor).
export const LANDING_DECODE_CAP_MS = 150;

export interface ArrivalHoldRelease {
  (): void;
  // Decode the held subtrees' images off-main before the landing commit.
  // WebKit paints an undecoded image by SYNCHRONOUSLY decoding the full
  // original on the main thread (profiled: RenderImage::paint →
  // ShareableBitmap::createFromImagePixels → AppleJPEG decode — ~380ms for
  // one production list's photos), so a landing that reveals images without
  // decoding first stalls the exact frames the eye is watching settle.
  // Bounded, and safe to skip (interrupt landings land immediately).
  prepareLanding: () => Promise<void>;
}

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

export default function createArrivalHold(scope: HTMLElement): ArrivalHoldRelease {
  if (typeof MutationObserver === "undefined") {
    const noopRelease = (() => {}) as ArrivalHoldRelease;
    noopRelease.prepareLanding = () => Promise.resolve();
    return noopRelease;
  }

  const heldArrivals = new Set<Element>();
  const parkedDepartures = new Set<Node>();
  // The hold defers VISIBILITY, never LOADING. A held subtree is
  // `display: none`, and a lazy image inside it stops loading entirely (no
  // viewport intersection) — so the landing's one-commit reveal used to push
  // every image into the viewport simultaneously: dozens of (cache-warm)
  // loads + layouts synchronized into a single main-thread task. Measured on
  // a production members list as a ~370ms stall right after the reveal — a
  // stall the pre-hold library never had, because mid-flight commits loaded
  // their images spread across the flight's frames. While held, lazy images
  // flip to eager and decode off-glass; the landing restores the authored
  // attribute in the same commit, with everything already fetched.
  const eagerizedImages = new Set<HTMLImageElement>();
  // Warm roughly a viewport's worth (the anim-hold's decode limit): eagerly
  // loading EVERY below-fold lazy image hands WebKit's idle margin-tile
  // prepaint hundreds of loaded-but-undecoded originals to synchronously
  // decode — a rest stall this module would be creating itself.
  const WARM_IMAGE_LIMIT = 20;
  const warmHeldImages = (root: Element) => {
    const images: HTMLImageElement[] = [];
    if (root instanceof HTMLImageElement) images.push(root);
    for (const image of Array.from(root.querySelectorAll("img"))) images.push(image);
    for (const image of images) {
      if (eagerizedImages.size >= WARM_IMAGE_LIMIT) break;
      if (eagerizedImages.has(image)) continue;
      if (image.getAttribute("loading") !== "lazy") continue;
      eagerizedImages.add(image);
      image.setAttribute("loading", "eager");
      const decode = () => {
        if (typeof image.decode === "function") image.decode().catch(() => {});
      };
      if (image.complete) decode();
      else image.addEventListener("load", decode, { once: true });
    }
  };
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
        warmHeldImages(added);
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

  const release = (() => {
    observer.disconnect();
    for (const parked of parkedDepartures) {
      parked.parentNode?.removeChild(parked);
    }
    parkedDepartures.clear();
    for (const held of heldArrivals) {
      held.removeAttribute(HELD_ARRIVAL_ATTR);
    }
    heldArrivals.clear();
    // Give the images their authored attribute back in the same commit; the
    // fetches the eager flip started are done (or in flight) either way.
    for (const image of eagerizedImages) {
      image.setAttribute("loading", "lazy");
    }
    eagerizedImages.clear();
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
  }) as ArrivalHoldRelease;

  release.prepareLanding = () => {
    const images: HTMLImageElement[] = [];
    for (const held of heldArrivals) {
      if (!held.isConnected) continue;
      if (held instanceof HTMLImageElement) images.push(held);
      for (const image of Array.from(held.querySelectorAll("img"))) images.push(image);
    }
    const decodable = images.filter(
      (image) => image.complete && typeof image.decode === "function"
    );
    if (decodable.length === 0) return Promise.resolve();
    const decodes = Promise.allSettled(decodable.map((image) => image.decode()));
    const cap = new Promise<void>((resolve) => {
      setTimeout(resolve, LANDING_DECODE_CAP_MS);
    });
    return Promise.race([decodes, cap]).then(() => {});
  };

  return release;
}
