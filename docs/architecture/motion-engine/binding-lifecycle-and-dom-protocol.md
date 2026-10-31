# Binding lifecycle and DOM protocol

This supplement covers the supplied `packages/core/src/core/engine/createTransitionEngine.ts`, `packages/core/src/core/engine/types.ts`, and `packages/core/src/dom/attributes.ts`.

- [Binding lifecycle](binding-lifecycle-and-dom-protocol/binding-lifecycle.md): inputs, disposal, per-pass cleanup, completion, and arrival landing.
- [DOM protocol](binding-lifecycle-and-dom-protocol/dom-protocol.md): attribute ownership and declared reader/writer contracts.

Executable engine branches establish lifecycle behavior; attribute declarations and comments establish intended protocol contracts. Neither establishes that unseen bindings or helpers implement every contract or that browser tests passed.
