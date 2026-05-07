import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
