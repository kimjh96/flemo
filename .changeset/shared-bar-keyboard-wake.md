---
"@flemo/core": patch
---

Keep a screen's shared bottom bar when it comes back. A screen covered while a software keyboard was open lost its viewport subscription to the freeze and never saw the keyboard close, so on the way back its shared bottom bar and system navigation bar stayed hidden and swipe-back stayed refused. The viewport observer now measures once for the whole app and hands the current measurement to any screen that (re)subscribes.
