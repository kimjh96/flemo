---
"@flemo/core": patch
---

Pair a morph only with the other side of the flight that is actually running. A `layoutId` is a name, not an address, and the same one legitimately sits on several screens of a stack — so pairing by name alone let a navigation between two screens reach down and grab an element belonging to neither. Two failures came out of that: a morph running on a navigation with no shared element in it, and an element staged at a rect measured on a screen that no longer exists — appearing full size in the middle of nowhere before its own screen had arrived, on the second walk through a stack. A partner must now be in the document and on a screen that is transitioning right now, on the side the arrival is not; snapshots of unmounted elements are dropped at the flip.
