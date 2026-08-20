---
"@flemo/react": patch
---

Publish `<Router defaultTransitionName>` at commit instead of during render. A render React
throws away (a transition that suspended) used to push its default into the live store anyway,
so a navigation from the screen still on display could play a transition the committed props
never asked for. The write is also skipped when the value has not changed, so subscribing to the
transition store no longer wakes on every single commit.
