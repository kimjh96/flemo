---
"@flemo/web": patch
---

Fix the Pretendard Variable font 404. The previous URL pointed at `cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/PretendardVariable.woff2` — but jsdelivr's `gh/` endpoint started returning 404 for this path, and the file was also reorganized: in `pretendard@1.3.9` the variable WOFF2 lives under a `woff2/` subdirectory (`dist/web/variable/woff2/PretendardVariable.woff2`), not directly in `dist/web/variable/`. Switched the URL to the npm-published `pretendard@1.3.9` via jsdelivr at the correct path. Verified `HTTP 200` with `content-type: font/woff2`.
