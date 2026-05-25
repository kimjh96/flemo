---
"@flemo/web": patch
---

Reframe the playground transitions panel: by default each push uses the transition that fits its own affordance (cupertino for browse-deeper hops, material for the player), set inline at every call site — there's no "harmonized" meta-option. The picker still exposes Built-in (cupertino / material / none) and Custom (blur) chips, but selecting one now **overrides** every push for comparison; tapping the active chip again drops back to the per-context default. The `resolvePushTransition` helper and its `_utils` folder are gone — the right model is "each navigation composes its own transition," not "a global resolver picks one." The code peek mirrors this: by default it shows the inline-per-site snippet, and only switches to a single `createTransition` source when an override is active.
