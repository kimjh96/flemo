---
"@flemo/core": patch
---

Remove the stall-demotion machinery from the driver policy. It moved a chronically-starved Blink device onto the compiled tier, and Blink now starts there, so it had nothing left to decide: the per-run gap accounting, strike counting, the irreversible in-session demotion and the persisted `flemo:motion-driver` ledger with its probation probe are gone. The force pin is now the only input to driver selection. Player frame gaps are still reported to the registry's diagnostic hook.
