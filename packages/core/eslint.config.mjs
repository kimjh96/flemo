import baseConfig from "@flemo/eslint-config";

export default [
  ...baseConfig,
  {
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          pathGroups: [
            { pattern: "@core/*", group: "internal", position: "before" },
            { pattern: "@history/*", group: "internal", position: "before" },
            { pattern: "@navigate/*", group: "internal", position: "before" },
            { pattern: "@transition/*", group: "internal", position: "before" },
            { pattern: "@utils/*", group: "internal", position: "before" }
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroupsExcludedImportTypes: [],
          "newlines-between": "always-and-inside-groups"
        }
      ]
    }
  }
];
