# Freeze a release corpus

Run the evaluation only after declaration changes, generated docs, and skill are publicly available from one release commit. Create a release lock outside the repository with this shape:

```json
{
  "schema": 1,
  "release": "vX.Y.Z",
  "commit": "full-git-commit",
  "packages": [
    { "name": "@flemo/core", "version": "CORE_VERSION", "integrity": "sha512-..." },
    { "name": "@flemo/react", "version": "REACT_VERSION", "integrity": "sha512-..." },
    { "name": "@flemo/devtools", "version": "DEVTOOLS_VERSION", "integrity": "sha512-..." }
  ],
  "docs": {
    "url": "https://flemo.dev/llms-full.txt",
    "sha256": "64-lowercase-hex"
  },
  "skill": {
    "files": [
      {
        "path": "SKILL.md",
        "url": "https://raw.githubusercontent.com/.../SKILL.md",
        "sha256": "64-lowercase-hex"
      },
      {
        "path": "references/routing-and-ownership.md",
        "url": "https://raw.githubusercontent.com/.../routing-and-ownership.md",
        "sha256": "64-lowercase-hex"
      },
      {
        "path": "references/composition.md",
        "url": "https://raw.githubusercontent.com/.../composition.md",
        "sha256": "64-lowercase-hex"
      },
      {
        "path": "references/motion-authoring.md",
        "url": "https://raw.githubusercontent.com/.../motion-authoring.md",
        "sha256": "64-lowercase-hex"
      },
      {
        "path": "references/verification.md",
        "url": "https://raw.githubusercontent.com/.../verification.md",
        "sha256": "64-lowercase-hex"
      }
    ]
  }
}
```

Prepare the sealed inputs:

```bash
pnpm eval:agents:validate
pnpm eval:agents:prepare -- --lock /absolute/release-lock.json --out /absolute/new-corpora
```

The preparer downloads exact public npm tarballs, checks registry integrity, keeps non-test `.d.ts` files, verifies every docs and skill byte by SHA-256, rejects implementation-file leakage, and emits a four-arm manifest. It refuses to overwrite an existing output directory.

Do not substitute local `dist`, repository source, git history, or playground code. Public package versions may differ across packages before release; a locally passing build is not evidence for this evaluation.
