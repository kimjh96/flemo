# Score a submission

The behavioural half of the registered endpoint. `protocol.json` owns the rubric; `score/` implements it and never re-weights it.

```bash
pnpm eval:agents:score -- --url http://localhost:4173 --submission /absolute/run-042 --out /absolute/run-042.json
```

`--url` is the submission's production build, already served. `--submission` is its directory, which the build criterion reads; without it that criterion is reported as not run and the result is not a scored run. `--out` writes the full report, including every failure sentence.

A run succeeds only when it clears 85 points and every critical criterion, with no repair prompt.

## What the scorer is allowed to know

The eleven `data-eval` roles every task prompt ends with, and the `data-flemo-*` attributes the engine publishes for any app it drives. Nothing else: not the submission's components, routes, class names or file layout. A criterion that cannot be seen from the page is not registered.

Two roles are read as the prompts write them rather than as separate attributes. The header's leading control is the way back, so a programmatic pop is a click on `shared-action`; the shared object is what opens the detail, so the identity flight is the one it starts.

## Proving the rubric separates

```bash
pnpm eval:agents:selftest -- --url http://localhost:3000/playground/composition \
  --map evals/flemo-agent-guidance/score/maps/composition-bench.json
```

Every criterion is run twice against one real application: untouched, where it must pass, and with a defect injected that its own sentence names, where it must fail. The defects are CSS and DOM only, so the application is never modified.

`--map` points the same criteria at an app that predates the contract — this repository's composition bench — which is how the scorer is rehearsed before any session exists. A map says where each role is; it can never add a role or change what a criterion asserts, and a scored run passes no map at all.

Some defects cannot be induced from outside a correctly built app. An overlay hosted in the layer cannot be pushed under the chrome by any stylesheet, because the layer is a sibling of every screen; the seed reproduces the consequence a reviewer reports instead, and says so where it is written.
