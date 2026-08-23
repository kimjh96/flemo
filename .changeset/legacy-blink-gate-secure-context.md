---
"@flemo/core": patch
---

Stop treating a missing UA-CH brands list as proof of an old browser. `navigator.userAgentData` is exposed only in a secure context, so a current Chrome looks identical to a 2019 one the moment a page is served over plain HTTP — and a Galaxy Z Flip 4 was taking the legacy Android Blink profile (the image decode offloader, the governed head kit) on a LAN test server. The browser version is now read positively from the user-agent string when the brands list is unavailable.
