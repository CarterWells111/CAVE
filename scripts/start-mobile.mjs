import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const modes = {
  "go-local": { client: "--go", profile: "development", gateway: "local" },
  "go-local-preview": { client: "--go", profile: "development", gateway: "local", assistantMode: "mock" },
  "dev-staging": { client: "--dev-client", profile: "development", gateway: "staging" },
  "dev-local": { client: "--dev-client", profile: "development", gateway: "local" },
  "acceptance-staging": { client: "--dev-client", profile: "acceptance", gateway: "staging" },
};
const mode = modes[process.argv[2]];
if (!mode) {
  console.error("Usage: node scripts/start-mobile.mjs <go-local|go-local-preview|dev-staging|dev-local|acceptance-staging> [Expo options]");
  process.exit(1);
}

function localGatewayUrl(value) {
  if (!value) throw new Error("Set CAVE_LOCAL_GATEWAY_URL to the computer's LAN Gateway URL, e.g. http://192.168.1.23:8787");
  const url = new URL(value);
  const parts = url.hostname.split(".").map(Number);
  const privateIp = parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168));
  const secureTunnel = url.protocol === "https:" && !["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname);
  if ((url.protocol !== "http:" || !privateIp) && !secureTunnel) {
    throw new Error("CAVE_LOCAL_GATEWAY_URL must be a private LAN HTTP address or a non-loopback HTTPS tunnel");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("CAVE_LOCAL_GATEWAY_URL must be a Gateway origin without credentials, path, query or fragment");
  }
  return url.origin;
}

const gatewayUrl = mode.gateway === "local"
  ? localGatewayUrl(process.env.CAVE_LOCAL_GATEWAY_URL)
  : "https://staging-api.neijiecave.com";
if (process.argv.includes("--print-env")) {
  console.log(JSON.stringify({ client: mode.client, profile: mode.profile, gatewayUrl, assistantMode: mode.assistantMode ?? "live", acceptanceTools: mode.profile === "acceptance" }));
  process.exit(0);
}
const require = createRequire(new URL("../apps/mobile/package.json", import.meta.url));
const child = spawn(process.execPath, [require.resolve("expo/bin/cli"), "start", mode.client, ...process.argv.slice(3)], {
  cwd: new URL("../apps/mobile/", import.meta.url),
  env: {
    ...process.env,
    EXPO_NO_DOTENV: "1",
    EAS_BUILD_PROFILE: mode.profile,
    CAVE_ACCEPTANCE_TOOLS: mode.profile === "acceptance" ? "1" : "0",
    EXPO_PUBLIC_ASSISTANT_MODE: mode.assistantMode ?? "live",
    EXPO_PUBLIC_GATEWAY_URL: gatewayUrl,
  },
  stdio: "inherit", windowsHide: true,
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
