import { ESLint } from "eslint";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("Astro frontmatter is parsed as TypeScript by the real web lint configuration", async () => {
  const cwd = resolve(import.meta.dirname, "../apps/web");
  const linter = new ESLint({ cwd, overrideConfigFile: resolve(cwd, "eslint.config.mjs") });
  const results = await linter.lintText("---\nconst title = 'synthetic' as string;\n---\n<h1>{title}</h1>\n", { filePath: resolve(cwd, "src/components/PageHero.astro") });
  expect(results.flatMap((result) => result.messages)).toEqual([]);
});
