import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["coverage", "dist", ".wrangler"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.serviceworker,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/node.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.serviceworker,
      },
    },
  },
  {
    files: ["src/__tests__/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.serviceworker,
      },
    },
  },
);
