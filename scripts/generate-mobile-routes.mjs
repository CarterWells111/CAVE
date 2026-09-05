import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/mobile");
const mobileRequire = createRequire(resolve(mobileRoot, "package.json"));

// Keep the pinned Router's internal generator behind one adapter. Its input and
// output are exercised by a real TypeScript consumer in mobile-route-types.test.
export function generateRoutes({
  appRoot = resolve(mobileRoot, "app"),
  outputDir = resolve(mobileRoot, ".expo/types"),
} = {}) {
  if (!statSync(appRoot).isDirectory()) throw new Error("Mobile route root must be a directory");
  const { getTypedRoutesDeclarationFile } = mobileRequire("@expo/router-server/build/typed-routes/generate");
  const { default: requireContext } = mobileRequire("expo-router/build/testing-library/require-context-ponyfill");
  const { EXPO_ROUTER_CTX_IGNORE } = mobileRequire("expo-router/_ctx-shared");
  const { getRoutes } = mobileRequire("expo-router/build/getRoutes");
  const context = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE);
  if (context.keys().length === 0) throw new Error("Mobile route root is empty");
  // The upstream declaration generator catches discovery errors. Validate first
  // so a malformed tree cannot silently replace a good cache with fallback types.
  const routes = getRoutes(context, {
    ignore: [/_layout\.[tj]sx?$/], platformRoutes: false, notFound: false,
    ignoreEntryPoints: true, ignoreRequireErrors: true, importMode: "async",
  });
  if (!routes) throw new Error("Expo Router found no application routes");
  const declaration = getTypedRoutesDeclarationFile(context);
  if (!declaration || !declaration.includes("export interface __routes")) {
    throw new Error("Expo Router did not generate route declarations");
  }
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, "router.d.ts"), declaration, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  generateRoutes();
}
