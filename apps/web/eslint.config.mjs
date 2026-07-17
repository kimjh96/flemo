import nextjsConfig from "@flemo/eslint-config/nextjs";

export default [
  ...nextjsConfig,
  {
    // e2e/perception holds a standalone manual measurement instrument (a Node
    // CLI that prints result tables to stdout and is never run in CI); it is
    // not app or library source, so it is out of scope for the app lint pass.
    ignores: [".next/**", ".source/**", "next-env.d.ts", "e2e/perception/**"]
  }
];
