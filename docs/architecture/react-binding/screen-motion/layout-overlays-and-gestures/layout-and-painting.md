# Screen layout and painting

Root screens and their viewport chrome use fixed positioning; contained screens use absolute positioning. The outer container applies `visibility: hidden` when `paintHidden` is true, independently of Activity effect teardown. It uses `isolation: isolate`, `contain: style`, and normally `zIndex + 1`; park-under temporarily uses `zIndex - 1`.

The content wrapper has no explicit transform or compositing promotion. Scroll overflow belongs to the wrapper when `contentScrollable` is true and to the scope when false. Positive viewport scroll height hides the bottom shared-bar spacer, bottom shared bar, and system-navigation chrome. Horizontal swipe authoring sets `touchAction: pan-y`; vertical swipe authoring sets `pan-x`.

Children mount with the screen inside the layer providers; there is no release-gated shell-first child mount. Entering inline styles are withheld for park-under and park-over. Consumer `props.style` is spread last.
