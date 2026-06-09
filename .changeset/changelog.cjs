// Custom changeset changelog formatter. Mirrors
// `@changesets/changelog-github`'s commit-linked output but omits the
// "Thanks [@user]!" suffix. flemo is solo-maintained, and the line reads
// as the author thanking themselves. The commit link stays for traceability.

function getReleaseLine(changeset, _type, options) {
  const repo = options && options.repo;
  const lines = changeset.summary.split("\n").map((line) => line.trimEnd());
  const [firstLine, ...rest] = lines;

  let prefix = "";
  if (changeset.commit && repo) {
    const sha = changeset.commit;
    const shortSha = sha.slice(0, 7);
    prefix = `[\`${shortSha}\`](https://github.com/${repo}/commit/${sha}) `;
  }

  const head = `- ${prefix}${firstLine}`;
  const body = rest.length > 0 ? "\n" + rest.map((line) => `  ${line}`).join("\n") : "";
  return `\n\n${head}${body}`;
}

function getDependencyReleaseLine(changesets, dependenciesUpdated, options) {
  if (dependenciesUpdated.length === 0) return "";
  const repo = options && options.repo;

  const commitLinks = changesets
    .filter((c) => c.commit)
    .map((c) => {
      const sha = c.commit;
      const shortSha = sha.slice(0, 7);
      return repo
        ? `[\`${shortSha}\`](https://github.com/${repo}/commit/${sha})`
        : `\`${shortSha}\``;
    });

  const header =
    commitLinks.length > 0
      ? `- Updated dependencies (${commitLinks.join(", ")}):`
      : "- Updated dependencies:";

  const items = dependenciesUpdated.map((dep) => `  - ${dep.name}@${dep.newVersion}`);
  return [header, ...items].join("\n");
}

module.exports = { getReleaseLine, getDependencyReleaseLine };
