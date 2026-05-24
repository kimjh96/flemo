import reactConfig from "@flemo/eslint-config/react";

export default [
  ...reactConfig,
  {
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          pathGroups: [
            { pattern: "react*", group: "builtin", position: "before" },
            { pattern: "@flemo/core", group: "external", position: "after" },
            { pattern: "@flemo/react", group: "external", position: "after" }
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroupsExcludedImportTypes: [],
          "newlines-between": "always-and-inside-groups"
        }
      ]
    }
  }
];
