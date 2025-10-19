import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextConfig from "./apps/web/eslint.config.mjs";

export default [
  ...nextConfig,
  ...tseslint.config({
    files: ["packages/**/*.{ts,tsx}"],
    ignores: ["**/dist/**"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.base.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-floating-promises": "error",
    },
  }),
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "pnpm-lock.yaml"],
  },
];
