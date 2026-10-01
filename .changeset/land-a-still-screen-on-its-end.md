---
"@flemo/core": patch
---

Land a navigation whose screen stands still (a container transform's camera, or an exit revealing a motionless screen) on the frame after its motion actually ends. It used to wait out a wall-clock estimate with a 50ms margin, holding the finished picture for 40 to 70ms before the landing repaint.
