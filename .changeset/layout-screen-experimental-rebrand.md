---
"@flemo/web": patch
---

Rebrand the LayoutScreen status pill from "Beta" to "Experimental" — the API is gated on the motion-free FLIP migration rather than a release-train milestone, and "Beta" implied "GA is next" which doesn't match intent. The frontmatter flag is now `experimental: true` (was `beta: true`); the docs title and sidebar entry share one `ExperimentalPill` component for visual consistency. The LayoutScreen install snippet was also removed from the README so the README stays focused on the stable surface.
