/** Shared ESLint rules layered on top of each app's framework preset. */
module.exports = {
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    eqeqeq: ["error", "always"],
  },
};
