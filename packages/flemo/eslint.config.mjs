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
            { pattern: "@core/*", group: "internal", position: "before" },
            { pattern: "@history/*", group: "internal", position: "before" },
            { pattern: "@navigate/*", group: "internal", position: "before" },
            { pattern: "@renderer/*", group: "internal", position: "before" },
            { pattern: "@screen/*", group: "internal", position: "before" },
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
