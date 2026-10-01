# Read the ladder out

```bash
pnpm eval:agents:analyse -- --ledger /absolute/ladder/ledger/ledger.json \
  --reports /absolute/reports --out /absolute/summary.json \
  [--sample /absolute/visual-sample.json]
```

Reports are the files `eval:agents:score` writes, one per session; pass `--session <id>` when scoring so each report says which session it belongs to.

The endpoint, the comparison and the threshold come from `protocol.json`. Nothing is chosen here, and nothing is reported that was not registered.

## The rules this enforces

**No early look.** The primary comparison is not computed until every planned session has a report. A ladder that can be read at run 40 and again at 60 and again at 96 has three chances to cross a threshold by luck. `--force` exists for a ladder that was deliberately stopped and stamps the output `INCOMPLETE`, so its number can never be quoted as the registered result.

**A missing report is a failure, not a gap.** The stopping rule counts a model or tool failure as a first-pass failure unless a provider outage was logged independently; mark those sessions `outage` in the ledger and they leave the denominator, visibly. Every other session without a report counts against its arm.

**Nothing is pooled across pools.** A ladder laid out with the network on is the external-validity arm and is reported on its own.

**The claim boundary travels with the number.** The summary carries the corpus release and commit, the provider families, and the protocol's own boundary sentence.

## The blind visual sample

`--sample` draws the reviewer's sample once every run id is sealed: one completed build per provider-by-arm stratum, variants balanced where the strata allow it. The file separates what the reviewer sees from what they must not: `labels` carries only a random label and an order, and `key` maps those labels back to sessions. Hand over the builds and `labels`; keep `key`.

Serve the selected builds under their labels with DevTools and capture closed, and record the direct visual verdict before looking at telemetry, recordings, source, or the automated score.
