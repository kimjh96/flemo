// Learned mount-cost policy: which routes must not make the tap wait.
//
// A navigation's entering screen mounts its content in one synchronous
// commit, and the transition (correctly) anchors its start to that commit's
// first painted frame. For most screens that commit is a frame or two. But a
// content-dense screen — measured on a production members list as ~380ms of
// render + layout + cached-image work on device — turns that anchor into a
// frozen tap: the input responds only after the commit finishes, because
// nothing can preempt a running synchronous task. No transition machinery
// downstream can fix a start that late.
//
// The fix inverts the order for exactly the screens that need it: a route
// whose full mount measurably blocked past CONTENT_DEFER_THRESHOLD_MS gets
// its consumer content deferred out of the entering commit on the NEXT
// visit (the binding renders it at hidden/background priority and reveals
// at rest), so the shell mounts in milliseconds and the motion starts
// immediately. Light screens keep the shipped content-first behavior — the
// unconditional version of this idea was reverted precisely because it made
// every light screen enter as a blank shell.
//
// Same evidence-driven pattern as the driver demotion: measure on this
// device, remember, act next time. Records expire after a day so an app
// that got lighter re-earns content-first mounting with a single probe.

export interface MountCostStorage {
  read: () => string | null;
  write: (value: string) => void;
}

// One long frame is tolerable; a block past ~5 frames reads as a frozen tap.
export const CONTENT_DEFER_THRESHOLD_MS = 80;

const STORAGE_KEY = "flemo:mount-cost";
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;
// Bound the persisted map; oldest records fall out first.
const MAX_ROUTES = 50;

interface MountCostRecord {
  ms: number;
  at: number;
}

const defaultStorage = (): MountCostStorage => ({
  read: () => {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage unavailable (private mode, embedder policy): the learning
      // simply lives for this session's in-memory reads only.
    }
  }
});

export interface MountCostPolicy {
  // Report a route's measured full-content mount block. Called only for
  // UN-deferred mounts — a deferred (shell) mount is cheap by construction
  // and must not erase the record that earned the deferral.
  record: (route: string, ms: number) => void;
  // Whether the route's next entering mount should defer its content.
  shouldDeferContent: (route: string) => boolean;
}

export const createMountCostPolicy = (
  storage: MountCostStorage = defaultStorage(),
  now: () => number = () => Date.now()
): MountCostPolicy => {
  const load = (): Map<string, MountCostRecord> => {
    try {
      const raw = storage.read();
      if (!raw) return new Map();
      const parsed = JSON.parse(raw) as Record<string, MountCostRecord>;
      const entries = Object.entries(parsed).filter(
        ([, value]) =>
          !!value &&
          typeof value.ms === "number" &&
          typeof value.at === "number" &&
          now() - value.at < RECORD_TTL_MS
      );
      return new Map(entries);
    } catch {
      return new Map();
    }
  };

  const save = (records: Map<string, MountCostRecord>) => {
    let entries = [...records.entries()];
    if (entries.length > MAX_ROUTES) {
      entries = entries.sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ROUTES);
    }
    storage.write(JSON.stringify(Object.fromEntries(entries)));
  };

  return {
    record: (route, ms) => {
      const records = load();
      records.set(route, { ms, at: now() });
      save(records);
    },
    shouldDeferContent: (route) => {
      const entry = load().get(route);
      return !!entry && entry.ms >= CONTENT_DEFER_THRESHOLD_MS;
    }
  };
};

const mountCostPolicy = createMountCostPolicy();

export default mountCostPolicy;
