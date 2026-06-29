---
"@flemo/web": patch
---

Give each page its own SEO metadata (per-doc titles and descriptions, localized
showcase/playground titles) instead of a single shared title. Remove fumadocs
entirely: docs render from typed data, locale routing moves to a small custom
middleware, and the body uses the app's own color tokens, dropping fumadocs-core,
fumadocs-ui, fumadocs-mdx and the unused MDX content/search pipeline.
