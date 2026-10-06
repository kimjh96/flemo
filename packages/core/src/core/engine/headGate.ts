// THE DESKTOP HEAD GATE IS ONE ATTRIBUTE FOR THE WHOLE PAGE.
//
// Whether a transition wears the desktop flat head is announced by
// `data-flemo-desk-head` on the root element, and the compiled head rules are
// gated on it (`:root[data-flemo-desk-head] <participant>`). On desktop Blink the
// answer is not a constant: it follows the release latency the session has
// measured per status (see resolveHeadKit), so one navigation can want the head
// and the next can want none.
//
// Every Router on the page reads that one attribute. When a second Router
// starts a transition while another Router's transition is still running (a
// nested demo playing itself inside a screen the shell is leaving, two sibling
// Routers), flipping the gate swaps the running transition's compiled
// animation-name from `<name>-deskhead` to `<name>`, and a changed
// animation-name restarts the animation from its first frame. Measured on
// flemo.dev, desktop Chrome: the docs page's live demo was 150ms into a push
// when the header's Home tap dropped the gate; the demo's arriving screen jumped
// back to its start and slid in again, uncovering the screen under it for a
// frame, which read as the page the visitor was leaving flashing back.
//
// So the gate holds still while anything runs under it. A transition that
// stamps the gate holds it until it settles, and a transition that starts
// meanwhile wears the gate as it already is instead of re-deciding it. The
// cost is bounded: the newcomer gets the head or loses it for one transition,
// which is the cover a head is (a few frames held at the from-pose), never a
// change to the authored motion. Nothing is held once the page is idle, so the
// next transition decides freshly.

const holders = new Set<{ desktopHead: boolean }>();

/**
 * The desktop head the running transitions are wearing, or null when none is
 * running and the next transition may decide for itself.
 */
export const heldDesktopHead = (): boolean | null => {
  for (const holder of holders) return holder.desktopHead;
  return null;
};

/**
 * Hold the gate at `desktopHead` for one transition run. Returns the release,
 * which is idempotent.
 */
export const holdDesktopHeadGate = (desktopHead: boolean): (() => void) => {
  const holder = { desktopHead };
  holders.add(holder);
  return () => {
    holders.delete(holder);
  };
};

// Test seam: the holders are page-scoped by design, so a suite that leaves a
// transition running must be able to put them back.
export const resetHeadGateForTests = (): void => {
  holders.clear();
};
