# Hand a report to an agent

1. Reproduce the problem once with the recorder attached.
2. Run `copy(JSON.stringify(window.flemo.report(), null, 2))`.
3. Paste the JSON into the issue or conversation.

Read `verdict`, then `preconditions`, then each transition's `anomalies`, then `blindSpots`. A number from a session with a violated precondition is not evidence.
