import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

import { baseConfig } from "./index.mjs";

export const reactConfig = [
  ...baseConfig,
  pluginReact.configs.flat.recommended,
  {
    plugins: { "react-hooks": pluginReactHooks },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/exhaustive-deps": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "react", importNames: ["default"] }]
        }
      ]
    },
    settings: {
      react: { version: "detect" }
    }
  }
];

export default reactConfig;
