import rootConfig from "../../eslint.config.mjs";
import astro from "eslint-plugin-astro";

export default [
  ...rootConfig,
  ...astro.configs["flat/recommended"]
];
