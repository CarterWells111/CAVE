import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://neijiecave.com",
  output: "static",
  trailingSlash: "never",
  build: {
    format: "directory",
    inlineStylesheets: "never"
  }
});
