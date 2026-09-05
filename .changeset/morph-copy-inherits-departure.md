---
"@flemo/core": patch
---

Stop a shared-element text morph starting compressed and a shade high. The copy that covers a flight's lead-in was stamped with the ARRIVING element's inherited values (letter-spacing, colour, line-height) rather than the DEPARTING element's, so the departing words rendered in the destination's tighter face and a pixel out of place until the flight moved. The copy now replicates the departure exactly, taking the departure's own computed values. The ascent cancellation is also held flat through the lead-in, so the line no longer sits low before the first frame moves.
