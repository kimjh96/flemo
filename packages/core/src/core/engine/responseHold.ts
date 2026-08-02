// Flight-scoped network RESPONSE hold: while a transition is in motion,
// fetch resolutions are parked and delivered in one batch at rest.
//
// The arrival hold (arrivalHold.ts) already relocates a mid-flight commit's
// VISIBLE effect to rest, and its display:none rule deletes the commit's
// layout cost — but the commit's REACT RENDER is script, and on a phone a
// detail screen's reveal render is a multi-hundred-ms main-thread task. For
// the rAF player that task is a measured frame famine right where the eye
// watches hardest (device: 42ms gaps, misses at the convergence; the
// intermittent mid-flight freeze). The render starts when the query's
// promise resolves — so the library moves THAT: a response arriving
// mid-flight is held (the network work is done; only the consumer callback
// waits) and delivered at rest, where its render lands in the same window
// the arrival hold was always going to reveal it anyway. From the
// consumer's view the network was simply ~a flight slower — and the pixels
// change on exactly the same frame they did before.
//
// Deliberately narrow: only fetch (the modern data path; plen/supabase
// included), only RESOLUTIONS (a request issued mid-flight still departs
// immediately — only its completion waits), rejections held the same way
// (an error handler triggers renders too), and a per-hold backstop so a
// missed release can never strand a promise.

let installed = false;
let holdDepth = 0;
let parked: (() => void)[] = [];

const flush = () => {
  const queue = parked;
  parked = [];
  for (const deliver of queue) deliver();
};

const install = () => {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (...args: Parameters<typeof fetch>) =>
    original(...args).then(
      (response) => {
        if (holdDepth <= 0) return response;
        return new Promise<Response>((resolve) => {
          parked.push(() => resolve(response));
        });
      },
      (error) => {
        if (holdDepth <= 0) throw error;
        return new Promise<Response>((_resolve, reject) => {
          parked.push(() => reject(error));
        });
      }
    );
};

// A missed release (an interrupted teardown path) must never strand consumer
// promises: generously past any flight, the hold self-releases.
const HOLD_BACKSTOP_MS = 2000;

// Begin holding responses; returns an idempotent release. Nested holds (both
// screens of a navigation arm one) stack — responses deliver when the LAST
// release lands, in one batch at rest.
export function beginResponseHold(): () => void {
  install();
  /* v8 ignore next -- SSR guard: without fetch there is nothing to hold. */
  if (!installed) return () => {};
  holdDepth += 1;
  let released = false;
  let backstop: ReturnType<typeof setTimeout> | null = null;
  const release = () => {
    if (released) return;
    released = true;
    if (backstop !== null) clearTimeout(backstop);
    holdDepth = Math.max(0, holdDepth - 1);
    if (holdDepth === 0) flush();
  };
  if (typeof setTimeout === "function") backstop = setTimeout(release, HOLD_BACKSTOP_MS);
  return release;
}

// Test seams.
export const heldResponseCount = (): number => parked.length;
export const responseHoldDepth = (): number => holdDepth;
