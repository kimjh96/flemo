# Read the ladder out

```bash
pnpm eval:agents:analyse -- --ledger /absolute/ladder/ledger/ledger.json \
  --reports /absolute/reports --out /absolute/summary.json \
  [--sample /absolute/visual-sample.json]
```

`eval:agents:score` writes one report per session. Pass `--session <id>` when scoring so each report identifies its session.

`protocol.json` defines the endpoint, comparison, and threshold. Analysis chooses none of these and reports only registered results.

## Analysis rules

- **No early look:** Compute the primary comparison only after every planned session has a report. Reading the ladder at runs 40, 60, and 96 creates three chances to cross the threshold by luck. For a deliberately stopped ladder, `--force` stamps the output `INCOMPLETE`; its number must never be quoted as the registered result.
- **Missing reports count as failures:** The stopping rule counts model or tool failures as first-pass failures unless a provider outage was independently logged. Mark those sessions `outage` in the ledger to visibly exclude them from the denominator. Every other session without a report counts against its arm.
- **Keep pools separate:** Never pool results across pools. A ladder run with the network on is the external-validity arm and is reported separately.
- **Carry the claim boundary:** The summary includes the corpus release and commit, provider families, and the protocol's boundary sentence.

## Blind visual sample

After every run id is sealed, `--sample` draws one completed build per provider-by-arm stratum, balancing variants where the strata allow. The sample file separates reviewer-visible information from concealed information: `labels` contains only a random label and an order; `key` maps labels to sessions. Hand over the builds and `labels`; keep `key` concealed.

Serve selected builds under their labels with DevTools and capture closed. Record the direct visual verdict before inspecting telemetry, recordings, source, or the automated score.
