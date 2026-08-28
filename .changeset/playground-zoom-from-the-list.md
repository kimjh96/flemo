---
"@flemo/web": patch
---

Make the playground's container transform work from the Tonight list, not only from the poster grid. The pair and the camera live on the card wrapper, and the list's rows never drew one, so picking `zoom` there flew a lone artwork over a plain fade. Each row is now a container of its own under list-scoped ids (`rowcard-`, `rowname-`), the detail answers to whichever surface opened it, and the row's venue-led meta line, which has no matching string on the detail, arrives with the body copy instead of pairing.
