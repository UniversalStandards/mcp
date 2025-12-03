import globals from "globals";

export default [
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error"
    }
  },
  {
    ignores: ["node_modules/", "dist/", "build/", "coverage/"]
  }
];
