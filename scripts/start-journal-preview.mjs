import { createRequire } from "node:module";
import { spawn } from "node:child_process";

// Starts a JavaScript development server only. Never creates a native build.
const require = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const child = spawn(process.execPath, [require.resolve("expo/bin/cli"), "start", "--go", ...process.argv.slice(2)], {
  cwd: new URL("../apps/mobile/", import.meta.url),
  env: { ...process.env, EXPO_PUBLIC_ASSISTANT_MODE: "mock" },
  stdio: "inherit", windowsHide: true,
});
child.on("error", () => { console.error("无法启动手记预览，请检查 Node 与 Expo 依赖。"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
