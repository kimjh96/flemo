# Docs writing guide

Apply these rules to typed docs content in `pages/*.ts` in both languages. Write for a React developer who has used a router and perhaps Framer Motion but has never read flemo's source. Every sentence must make sense without knowledge of engine internals.

Engine metaphors such as clock, rider, and pose stay in `docs/architecture/` and must not reach site readers. The word "flight" is retired from code and docs: use "transition" everywhere, including API names such as `after: "transition"` and `attachTransitionRecorder`.

- [Vocabulary](writing-guide/vocabulary.md): preserved terms and replacements for internal metaphors.
- [Sentences](writing-guide/sentences.md): reader-focused prose and presentation order.
- [Korean](writing-guide/korean.md): tone, identifiers, and transition terminology.
