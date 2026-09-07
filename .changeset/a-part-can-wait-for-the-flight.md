---
"@flemo/core": minor
"@flemo/web": patch
---

Let a `<Part>` say `after: "flight"` instead of writing the flight's length
down. Chrome that a flight covers has to wait exactly as long as the flight and
be revealed at its landing, and that length belongs to whichever transition is
carrying it: writing it in the part meant one part per transition plus a table
of their durations. The playground's detail header was eight such rows; it is
one part now, and a transition with no row in that table no longer means a part
that does not exist.
