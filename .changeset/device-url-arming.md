---
"@flemo/core": patch
---

Arm the two device-diagnosis flags from the URL, alongside the existing `?flemo-layers=` and `?flemo-freeze=`. `?flemo-settle=on|off|auto` toggles the render-settle entry gate and `?flemo-driver=css|raf|off` sets the driver force pin (stamped, so `driverPolicy` honors it). Setting `sessionStorage` by hand requires attaching a desktop debugger to the phone, which is the friction that keeps weak-device A/B from happening.
