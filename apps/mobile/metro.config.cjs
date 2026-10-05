const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
const dependencyRoot = fs.realpathSync.native(path.join(workspaceRoot, "node_modules"));
const linkedWorkspaceRoot = path.dirname(dependencyRoot);
const nestedWorktreesRoot = path.join(workspaceRoot, ".worktrees")
  .replaceAll("\\", "/")
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  .replaceAll("/", "[/\\\\]");

config.watchFolders = [...new Set([
  ...(config.watchFolders ?? []),
  workspaceRoot,
  ...(linkedWorkspaceRoot !== workspaceRoot ? [linkedWorkspaceRoot] : []),
])];
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  new RegExp(`${nestedWorktreesRoot}[/\\\\]`),
];

module.exports = config;
