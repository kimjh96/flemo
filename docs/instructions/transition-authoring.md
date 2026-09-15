# Authoring a flemo transition

Read these rules before writing `createTransition`, `createMorphTransition`, `createPartTransition`, or `createDecorator`, or wiring `<Slot>`, `<Part>`, or `<Morph>`.

They describe runtime behavior. Violations can pass types, produce correct DOM, and leave the console silent while producing wrong motion. Referenced source comments explain each rule.

- [Router topology](transition-authoring/topology.md): choose the navigation owner and visual boundary.
- [Motion semantics and slots](transition-authoring/semantics.md): understand morph behavior and select poses by factory, status, and stack position.
- [Clocks and options](transition-authoring/timing-options.md): inherit timing and configure flight behavior.
- [Diagnostics and completion](transition-authoring/validation.md): trace symptoms and verify the result.
