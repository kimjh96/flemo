---
"@flemo/core": minor
---

`TransitionTarget` now extends `csstype.Properties`, so every transition-able CSS property — `filter`, `backdropFilter`, `color`, `boxShadow`, `borderRadius`, `clipPath`, `letterSpacing`, and the rest of the CSS surface — gets full IDE autocomplete and value-type narrowing inside `createTransition({ initial, idle, enter, ... })`. The previous interface only typed transform shortcuts, `opacity`, and `backgroundColor`; every other property still worked at runtime thanks to the broad index signature, but offered zero editor support. flemo-specific transform aliases (`x`, `y`, `z`, `scale*`, `rotate*`) keep their existing semantics — csstype's own `rotate` / `scale` / `translate` standalone properties are omitted so the shortcut wins. CSS custom properties (`--foo`) remain animatable via a `--`-prefixed index signature.
