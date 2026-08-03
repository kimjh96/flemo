// Flight-scoped network RESPONSE hold: while a transition is in motion, a
// mid-flight fetch RESOLUTION is parked and delivered in one batch at rest.
//
// Why this exists AND why it is narrowly scoped. The arrival hold
// (arrivalHold.ts) hides a mid-flight commit with display:none, deleting its
// LAYOUT/paint cost — but the commit's REACT RENDER is script, and on a phone
// a detail screen's suspense reveal is a multi-hundred-ms main-thread task.
// For the rAF player that task is a measured frame famine right at the
// convergence (device: intermittent end-of-flight stutter), because the
// render fires the instant its query's promise resolves. So the library moves
// THAT resolution to rest, where the arrival hold was going to reveal the
// pixels anyway — from the consumer's view the network was ~a flight slower,
// and the pixels change on the same frame they did before.
//
// Scope: EVERY method, minus streams. A GET-only version was tried and
// device-falsified: real data layers drive reveals through non-GET reads —
// Supabase RPC queries travel as POST /rest/v1/rpc/*, and count queries as
// HEAD — and one instrumented member-detail push showed six HEAD counts and
// one POST RPC resolving mid-flight past the GET filter, each firing a query
// cache update and a render on the convergence frames (the "intermittent
// end-stutter came back" report). Reads and mutations are indistinguishable
// at the fetch layer, so the hold parks both; a mutation's resolution is
// delayed by at most one flight span — the exact behavior the device-perfect
// original shipped. What it never parks:
// - STREAM responses (content-type event-stream): parking would stall the
//   stream's own start, and its consumer wants sub-flight delivery.
// Bounded by the FLIGHT's span (the caller passes it): a genuinely long
// authored transition is never cut short, and nothing is held longer than
// one flight. Residual, documented: a fetch raced against a short (< one
// flight) timeout that resolves mid-flight sees the timeout win.

let installed = false;
let holdDepth = 0;
let parked: (() => void)[] = [];

const flush = () => {
  const queue = parked;
  parked = [];
  for (const deliver of queue) deliver();
};

const isStream = (response: Response): boolean =>
  /event-stream/i.test(response.headers.get("content-type") ?? "");

const install = () => {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (...args: Parameters<typeof fetch>) => {
    return original(...args).then(
      (response) => {
        if (holdDepth <= 0 || isStream(response)) return response;
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
};

// Floor for the self-release backstop; the caller passes the flight's span so
// a long authored transition is never cut short (the fixed value alone once
// flushed a 1s response into the middle of an authored 3s+ transition).
const MIN_HOLD_BACKSTOP_MS = 2000;

// Begin holding fetch responses; returns an idempotent release. Nested holds
// (both screens of a navigation arm one) stack — responses deliver when the
// LAST release lands, in one batch at rest. `backstopMs` is the self-release
// insurance bound: pass the flight span + margin.
export function beginResponseHold(backstopMs = MIN_HOLD_BACKSTOP_MS): () => void {
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
  if (typeof setTimeout === "function") {
    backstop = setTimeout(release, Math.max(MIN_HOLD_BACKSTOP_MS, backstopMs));
  }
  return release;
}

// Test seams.
export const heldResponseCount = (): number => parked.length;
export const responseHoldDepth = (): number => holdDepth;
