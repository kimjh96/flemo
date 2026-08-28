---
"@flemo/web": patch
---

Zero the playground caption's flight-start jumps by giving both ends of the pair identical local geometry. A flying text morph starts at its own local offsets inside the card, so every difference between the two ends' insets and spacing was a jump on the first frame: the name lurched 20px right on a push, the name and date lurched 20px left with their gap collapsing on a pop, and the facts rows spread from 20px to 24px because the flight stamps the card's computed line-height onto rows that only set a font size. Both ends now use a 16px inset, 12px under the artwork, equal title-plus-gap sums, and the facts pin their own line height; measured at the first frames of both directions, every caption delta is zero.
