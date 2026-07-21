"use client";

import "./LabRevealProbe.styles.css";

// A 1×1 invisible probe carrying the delayed-reveal animation pattern
// (`180ms ease 500ms both`, transparent until the delay elapses) that
// production apps use for skeleton gating. It paints nothing a visitor can
// see; the e2e perception suite reads its computed style to pin the
// quarantine contract: the authored hidden pose must hold during a
// navigation's flight, and the reveal must continue on its original clock at
// the landing — never restart.
function LabRevealProbe() {
  return <div data-testid="lab-reveal-probe" className="lab-reveal-probe" aria-hidden />;
}

export default LabRevealProbe;
