# Implementation and validation rules

- Path aliases: `@history`, `@navigate`, `@renderer`, `@screen`, `@stores`, `@transition`, `@utils`, `@Route`, `@Router`. Import core only through named imports from `@flemo/core`.
- During render, compute everything the engine needs in the first paint of a state change: hold attributes, riding flags, and freeze tracking refs. Never compute these in an effect.
- Tests live beside source in `__tests__/`. jsdom reports an empty platform and no touch, taking the ungoverned path with no head; see [transition routing](../driver-routing.md).
