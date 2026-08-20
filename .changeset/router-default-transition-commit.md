---
"@flemo/react": patch
---

Publish `<Router defaultTransitionName>` at commit instead of during render. A render React
throws away (a transition that suspended) used to push its default into the live store anyway,
so a navigation from the screen still on display could play a transition the committed props
never asked for.
