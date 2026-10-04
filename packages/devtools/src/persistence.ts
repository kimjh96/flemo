import type { TransitionRecord, PreviousSession } from "./types";

// CARRYING THE TRACE ACROSS A PAGE LOAD.
//
// A development session reloads constantly — hot reload, a rebuild, a hard
// refresh to clear state — and each reload used to take the trace with it,
// including the one transition the user had just watched go wrong. That is not a
// theoretical loss: the transitions worth reading are the ones somebody just saw,
// and asking them to reproduce it after a reload is asking for the thing that
// only happens once.
//
// Two rules keep this from becoming the cost it is measuring:
//
//   1. NEVER WRITE DURING A TRANSITION. `sessionStorage` is synchronous main-thread
//      I/O, and a JSON serialization of the whole buffer inside a transition is
//      exactly the long task this package exists to find.
//   2. BOUNDED. A capped number of transitions and a capped payload, oldest
//      dropped first, so a long session cannot fill the quota and start
//      throwing on every write.

export const TRACE_KEY = "flemo:devtools-trace";
/** Transitions carried across a load. The recent ones are the ones anybody reads. */
export const MAX_PERSISTED_TRANSITIONS = 10;
/** Payload ceiling. sessionStorage quotas are small and shared with the app. */
export const MAX_PERSISTED_BYTES = 64_000;

interface StoredTrace {
  version: string;
  savedAt: string;
  transitions: TransitionRecord[];
}

const storage = (): Storage | null => {
  try {
    const store = sessionStorage;
    void store.length;
    return store;
  } catch {
    return null;
  }
};

/**
 * Write the tail of the buffer. Trims by count first and then by size, because
 * one transition with a hundred long gaps can be larger than nine ordinary ones.
 */
export const saveTrace = (transitions: readonly TransitionRecord[], version: string): void => {
  const store = storage();
  if (!store) return;
  let tail = transitions.slice(-MAX_PERSISTED_TRANSITIONS);
  while (tail.length > 0) {
    const payload = JSON.stringify({
      version,
      savedAt: new Date().toISOString(),
      transitions: tail
    } satisfies StoredTrace);
    if (payload.length <= MAX_PERSISTED_BYTES) {
      try {
        store.setItem(TRACE_KEY, payload);
      } catch {
        // Quota or a partitioned document: the live buffer is unaffected.
      }
      return;
    }
    tail = tail.slice(1);
  }
  clearTrace();
};

export const clearTrace = (): void => {
  try {
    storage()?.removeItem(TRACE_KEY);
  } catch {
    // Nothing to do: a storage that cannot be written cannot be cleared.
  }
};

/**
 * Read the previous page instance's tail, once, at attach.
 *
 * A trace whose schema version does not match this build is DROPPED rather
 * than coerced: a report that mixes two schemas is worse than one that says
 * the older transitions are gone.
 */
export const loadTrace = (version: string): PreviousSession | null => {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(TRACE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: StoredTrace | null = null;
  try {
    parsed = JSON.parse(raw) as StoredTrace;
  } catch {
    clearTrace();
    return null;
  }
  if (!parsed || parsed.version !== version || !Array.isArray(parsed.transitions)) {
    clearTrace();
    return null;
  }
  return {
    savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    transitions: parsed.transitions,
    note:
      "These transitions were recorded by the page instance BEFORE the last full load. They are " +
      "kept apart from the live ones because they may have come from a different build."
  };
};
