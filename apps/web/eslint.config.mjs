import rootConfig from "../../eslint.config.mjs";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  ...rootConfig,
  ...astro.configs["flat/recommended"],
  {
    files: ["**/*.astro"],
    languageOptions: { parserOptions: { parser: tseslint.parser } }
  }
];
