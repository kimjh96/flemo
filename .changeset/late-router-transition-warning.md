---
"@flemo/core": patch
"@flemo/react": patch
---

Stop a nested Router that mounts after another Router from reporting its own default transition as unregistered in development. `resolveTransition` takes a `quiet` option for lookups made before a Router has registered.
