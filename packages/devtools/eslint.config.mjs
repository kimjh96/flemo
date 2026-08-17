import baseConfig from "@flemo/eslint-config";

export default [
  ...baseConfig,
  {
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroupsExcludedImportTypes: [],
          "newlines-between": "always-and-inside-groups"
        }
      ]
    }
  }
];
