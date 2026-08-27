"use client";

// The chrome the overlay has to beat, painted so the verdict is a glance.
//
// Fluorescent yellow across the full width, with a black stripe down the
// middle. The sheet is deliberately NARROWER than the bar, so both are on
// screen at once and the question is a single visual fact: does magenta cut
// through the black stripe while yellow still shows at the sides?
//
// A readout would have been easier to write and worthless to trust. This is a
// judging stage; the eye is the instrument.
function LayerTabBar() {
  return (
    <nav
      data-layer-bar=""
      aria-label="layer fixture chrome"
      className="relative flex h-[72px] w-full items-center justify-center bg-[#e8ff00]"
    >
      <span className="absolute inset-y-0 left-1/2 w-[8px] -translate-x-1/2 bg-black" />
    </nav>
  );
}

export default LayerTabBar;
