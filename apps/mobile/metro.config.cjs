const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
const nestedWorktreesRoot = path.join(workspaceRoot, ".worktrees")
  .replaceAll("\\", "/")
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  .replaceAll("/", "[/\\\\]");

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  new RegExp(`${nestedWorktreesRoot}[/\\\\]`),
];

module.exports = config;
