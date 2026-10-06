# Bar riding and identity

During render, `computeBarRiding` sets `data-flemo-bar-riding` in the same commit as the bar's status attribute; the compiled sibling selector depends on both.

When a drag is declared, swipe stages bars in the same call as their screen. When a transition drives its own screens, the controller synchronously mirrors writes onto the bars.

Bars hand over only when position and optional ID match. Two unlabelled bars retain legacy matching. A labelled bar never aliases an unlabelled bar or one with another label.

DOM fallback IDs include `data-flemo-bar-id-type`, preserving numeric `3` versus string `"3"` when a frozen partner's registry has not reconnected.
