---
"@flemo/web": patch
---

Keep the locale prefix in the shell URL with a locale-aware history driver instead of stripping it on entry. The Router matches unprefixed paths while the driver maps the `/ko` prefix, so SEO URLs are preserved, the language survives a refresh from the URL (no localStorage), the toggle switches locale in place by re-prefixing, and the load-time URL strip is gone.
