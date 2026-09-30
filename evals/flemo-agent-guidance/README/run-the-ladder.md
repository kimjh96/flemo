# Lay out and run the ladder

```bash
pnpm eval:agents:ladder -- --corpus /absolute/corpora --out /absolute/ladder \
  --providers alpha,beta,gamma,delta [--seed <text>] [--network off]
```

This command creates every session directory and writes the ledger without contacting a provider. Any runner is allowed if each session starts fresh, sees only its own directory, and has no network. Binding the ladder to a vendor's CLI would measure that harness rather than the guidance.

## Session contents and isolation

```
sessions/run-017/
  TASK.md        the shared instruction and one variant prompt
  reference/     this session's arm, under the same folder name in every session
  submission/    the starter, with @flemo/react pinned to the corpus release
```

The arm's directory name never appears inside a session: all four arms use `reference/`. Arm identities are recorded in `ledger/`, outside the session tree. Point the runner at one `sessions/<id>` directory and nothing above it.

Each session is audited as it is written. An unexpected directory entry or task text naming the treatment stops the entire layout, preventing a run that would need discarding later.

## Plan guarantees

The plan is a full factorial: every provider family runs every arm on every variant twice. Balance is checked before anything is written.

Order is shuffled using a recorded seed so provider load, a model revision rolled out mid-run, or machine warm-up cannot be mistaken for the treatment. The same seed regenerates the same plan.

## Run a session

Install the starter's dependencies, then start your chosen runner with only `sessions/<id>` allowlisted. Before revealing any arm label, append the provider, model, model version, runner version, exit state, and timestamps to that session's ledger entry.

## Score a session

Build and serve the submission, then [score it](./scoring.md) with `--submission` pointing at the same directory. A network-enabled run is the external-validity arm and is reported separately; the ledger records whether the network was enabled.
