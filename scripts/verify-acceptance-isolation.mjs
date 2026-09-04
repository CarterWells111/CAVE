import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("apps/mobile/dist/_expo/static/js/ios");
const files = readdirSync(root).filter((name) => /\.(?:js|hbc)$/u.test(name));
if (!files.length) throw new Error("No production iOS bundle found; export iOS first");
for (const file of files) {
  const content = readFileSync(resolve(root, file)).toString("utf8");
  for (const marker of ["CAVE_ACCEPTANCE_TOOLING_ONLY", "cave-acceptance.db", "cave.acceptance."]) {
    if (content.includes(marker)) throw new Error(`Development acceptance tooling leaked into production bundle: ${file}`);
  }
}
console.log("Production bundle excludes acceptance tools and synthetic-storage targets.");
