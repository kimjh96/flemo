---
"@flemo/core": patch
---

Stop appending `px` to unitless CSS property values during transition compilation. Numbers passed to `lineHeight`, `fontWeight`, `zIndex`, `flexGrow`, `flexShrink`, `aspectRatio`, `columnCount`, `order`, `tabSize`, SVG opacity / stroke numerics, and similar unitless properties now compile straight through (`{ lineHeight: 1.5 }` → `line-height: 1.5;`). Previously the compiler defaulted any non-transform number to `…px`, which emitted invalid declarations like `line-height: 1.5px`. String values were already passed through verbatim, so the existing `"1.5"` workaround stays compatible. Mirrors the well-known unitless-property allowlist React uses for inline styles.
