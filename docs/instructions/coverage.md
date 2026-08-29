# Coverage

Cover every branch a change adds, and verify it by reading the Codecov report rather than the check list.

`codecov/patch` and `codecov/project` go green while the comment body still carries a cross and partial warnings, so a pull request can ship uncovered lines with every check passing. Read the report with `gh pr view <n> --json comments`, or run `bunx vitest run --coverage` before pushing: a file at full coverage drops off that table entirely, so a NEW file appearing in it is the signal.

Where a branch cannot be reached, delete it rather than leave it untested.
