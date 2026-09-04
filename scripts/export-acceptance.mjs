import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const child = spawn(process.execPath, [require.resolve("expo/bin/cli"), "export", "--dev", "--platform", "ios", "--output-dir", "dist-acceptance"], {
  cwd: new URL("../apps/mobile/", import.meta.url),
  env: { ...process.env, EAS_BUILD_PROFILE: "acceptance", CAVE_ACCEPTANCE_TOOLS: "1" },
  stdio: "inherit", windowsHide: true,
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
