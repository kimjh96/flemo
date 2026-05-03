import { reactConfig } from "./react.mjs";

export const nextjsConfig = [
  ...reactConfig,
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }]
    }
  }
];

export default nextjsConfig;
