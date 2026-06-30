---
"@flemo/core": minor
"@flemo/react": minor
---

Rename the `Screen` bar props to position-based, platform-neutral names: `appBar` to `topBar`, `navigationBar` to `bottomBar`, `sharedAppBar` to `sharedTopBar`, `sharedNavigationBar` to `sharedBottomBar` (the exported `SharedBarPresence` fields rename to match). Behavior is unchanged. This is a breaking rename: update any `Screen` that sets these props. The old `navigationBar` was easy to misread since it means the top bar on iOS and the web, while flemo uses it for the bottom one.
