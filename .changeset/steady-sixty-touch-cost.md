---
"@flemo/core": patch
---

Stop building the steady-60 desktop verdict on touch devices. The verdict is a
desktop profile — a touch session can never read it — but every Blink flight
was still feeding it, which cost a synchronous `sessionStorage` write per
flight on exactly the phones that can least afford one. The display probe that
feeds it still runs there: its other output (the learned frame interval) does
reach touch Blink.
