# Score a submission

Scoring is the behavioural half of the registered endpoint. `protocol.json` owns the rubric; `score/` implements it without re-weighting.

```bash
pnpm eval:agents:score -- --url http://localhost:4173 --submission /absolute/run-042 --out /absolute/run-042.json
```

- `--url` points to the submission's already-served production build.
- `--submission` points to its directory, which the build criterion reads. Without it, that criterion is reported as not run and the result is not a scored run.
- `--out` writes the full report, including every failure sentence.

A run succeeds only when it clears 85 points and every critical criterion, with no repair prompt.

## Scorer evidence boundary

The scorer may know only the eleven `data-eval` roles at the end of every task prompt and the `data-flemo-*` attributes the engine publishes for any app it drives. It may not know the submission's components, routes, class names, or file layout. A criterion that cannot be observed from the page is not registered.

Two roles are interpreted as written in the prompts, rather than as separate attributes:

- The header's leading control is the way back, so a programmatic pop is a click on `shared-action`.
- The shared object opens the detail, so the identity transition is the one that object starts.

## Validate rubric separation

```bash
pnpm eval:agents:selftest -- --url http://localhost:3000/playground/composition \
  --map evals/flemo-agent-guidance/score/maps/composition-bench.json
```

Every criterion runs twice against one real application: untouched, where it must pass, and with the defect named by its own sentence injected, where it must fail. Defects use CSS and DOM only; the application is never modified.

`--map` points the same criteria at this repository's composition bench, an app that predates the contract, to rehearse the scorer before any session exists. A map locates each role; it cannot add roles or change criterion assertions. A scored run passes no map.

Some defects cannot be induced externally in a correctly built app. An overlay hosted in the layer cannot be pushed under the chrome by any stylesheet because the layer is a sibling of every screen. Instead, the seed reproduces the consequence a reviewer reports and documents that substitution where it is written.
