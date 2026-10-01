// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      "no-use-before-define": ["error", { functions: false, classes: false, variables: false, allowNamedExports: true }],
    },
  }
]);
