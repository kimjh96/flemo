import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginImport from "eslint-plugin-import";
import pluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

export const baseConfig = [
  { files: ["**/*.{js,mjs,cjs,mts,ts,jsx,tsx}"] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ["dist", ".next", ".turbo", "node_modules", "coverage"] },
  eslintConfigPrettier,
  pluginImport.flatConfigs.recommended,
  pluginPrettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true
        }
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false }
      ],
      // TypeScript already validates module resolution and these rules misfire
      // on path aliases / type-only imports in IDEs; defer to tsc.
      "import/no-unresolved": "off",
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off"
    },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
        node: true
      }
    }
  }
];

export default baseConfig;
