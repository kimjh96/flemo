---
"@flemo/web": patch
---

Load the flight recorder through a dev-only dynamic import so it no longer ships in the playground's production bundle, and document the same pattern in the `@flemo/devtools` README. Installing the package as a devDependency controls what is installed, not what is bundled — a plain top-level import of a package you call at runtime reaches every visitor.
