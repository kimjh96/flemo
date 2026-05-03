import nextjsConfig from "@flemo/eslint-config/nextjs";

export default [
  ...nextjsConfig,
  {
    ignores: [".next/**", ".source/**", "next-env.d.ts"]
  }
];
