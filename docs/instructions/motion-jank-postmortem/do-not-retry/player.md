# Player micro-policy falsifications

- **Jitter-cap + commit-miss compensation from synthetic A/B** — real pages have per-frame render cost that looks like a missed commit window, so compensation constantly held frames. The synthetic win did not transfer. This is noted in `stepPlayer`; do not retry without an adaptive per-page baseline.
- **MIN-estimator display interval** — one runt gap throttled the entire transition. The median with a sustained-slow requirement is deliberate.
- **Per-transition warm variants for present pacing** — only the session-permanent form helps; see [Chrome presentation pipeline](chrome-presentation.md).
