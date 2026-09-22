# Run and score

Use any provider runner that starts a fresh session with an allowlisted input directory and no network. Before unblinding, record provider, model, model version, runner version, arm alias, task, seed, timestamps, exit state, build hash, and evaluator hash.

Automated scoring uses production builds. Development builds are a separate diagnostic pass for `@flemo/devtools`, whose normal recorder is intentionally inert in production. A run succeeds only if it clears the registered 85-point threshold and every critical criterion without a repair prompt.

The product owner's visual review is a separate blind gate. Serve only selected compiled builds under random IDs, with DevTools and capture closed for the first verdict. Do not expose source, comments, treatment, provider, transcript, or automated score. Record the direct visual judgment before using telemetry or recordings to diagnose it.
