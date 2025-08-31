import globals from "globals";
import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["**/node_modules/**", "dist/**", "build/**", ".git/**", "app.log", "**/fair.js", "**/run-test.js"],
  },
  {
    languageOptions: { globals: globals.node },
  },
  pluginJs.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": ["error", { printWidth: 120 }],
      "no-undef": ["error", { typeof: true }],
      "no-unused-vars": ["error", { varsIgnorePattern: "^_" }],
      "no-duplicate-imports": "error",
      "no-unreachable-loop": "warn",
      "no-use-before-define": "warn",
      "no-useless-assignment": "warn",
      "block-scoped-var": "warn",
      "capitalized-comments": "warn",
      camelcase: "warn",
      "dot-notation": "warn",
      "no-magic-numbers": ["error", { ignore: [-1, 0, 1, 60, 1000, 3600] }],
      "no-negated-condition": "warn",
      "no-unneeded-ternary": "warn",
      "no-unused-expressions": "warn",
      "prefer-const": "warn",
      "prefer-named-capture-group": "warn",
      radix: "warn",
      // "require-await": "warn",
      // Curly
    },
  },
];
