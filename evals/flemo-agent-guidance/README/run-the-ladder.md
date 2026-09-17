# Lay out and run the ladder

```bash
pnpm eval:agents:ladder -- --corpus /absolute/corpora --out /absolute/ladder \
  --providers alpha,beta,gamma,delta [--seed <text>] [--network off]
```

This lays out every session's directory and writes the ledger. It does not talk to a provider: the protocol allows any runner, so long as each session starts fresh, sees only its own directory, and has no network. Binding the ladder to one vendor's CLI would make the result a claim about that harness rather than about the guidance.

## What a session gets

```
sessions/run-017/
  TASK.md        the shared instruction and one variant prompt
  reference/     this session's arm, under the same folder name in every session
  submission/    the starter, with @flemo/react pinned to the corpus release
```

The arm's directory name never appears inside a session; `reference/` is the same word in all four arms, and the ledger that remembers which arm it was is written to `ledger/`, outside the session tree. Point the runner at one `sessions/<id>` directory and nothing above it.

Every session is audited as it is written: an unexpected entry in the directory, or a task text that names the treatment, stops the whole layout rather than producing a run that has to be discarded afterwards.

## What the plan guarantees

A full factorial — every provider family runs every arm on every variant, twice — checked to be even before anything is written. The order is shuffled from a recorded seed, so a provider's load, a model revision rolled out mid-run, or a machine warming up cannot be read as the treatment. The same seed regenerates the same plan.

## Running a session

Install the starter's dependencies, then start the session with the runner of your choice, allowlisting only `sessions/<id>`. Append the provider, model, model version, runner version, exit state and timestamps to that session's ledger entry before any arm label is revealed.

## Scoring

Build and serve the submission, then [score it](./scoring.md) with `--submission` pointing at the same directory. A run with the network on is the external-validity arm and is reported separately; the ledger records which it was.
