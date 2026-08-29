import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";
import ts from "typescript";

const workspaceRoot = resolve(import.meta.dirname, "..");
const explicitTargets = process.argv.slice(2).map((target) => resolve(target));
const targets = explicitTargets.length > 0
  ? explicitTargets
  : [
      resolve(workspaceRoot, "apps/mobile/src"),
      resolve(workspaceRoot, "apps/mobile/app")
    ];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const imageSaveAdapter = "features/journey/infrastructure/expo-card-image-adapter.ts";
const authApiAdapter = "features/auth/infrastructure/auth-api-client.ts";
const permissionMethods = new Set([
  "requestCameraPermissionsAsync",
  "requestMediaLibraryPermissionsAsync",
  "requestMicrophonePermissionsAsync",
  "requestPermissionsAsync"
]);
const logMethods = new Set(["debug", "error", "info", "log", "warn"]);

function normalizePath(path) {
  return path.split(sep).join("/");
}

function isDemoSourceFile(path) {
  const normalized = normalizePath(path);
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);

  return sourceExtensions.has(extname(path))
    && !normalized.split("/").includes("test")
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(basename);
}

function listDirectoryFiles(path) {
  return readdirSync(path, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .flatMap((entry) => {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) return listDirectoryFiles(child);
      return entry.isFile() && isDemoSourceFile(child) ? [child] : [];
    });
}

function readSource(path) {
  return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));
}

function targetLabel(path) {
  const workspacePath = normalizePath(relative(workspaceRoot, path));
  return workspacePath !== "" && !workspacePath.startsWith("../")
    ? workspacePath
    : basename(path) || normalizePath(path);
}

function collectTarget(path) {
  let details;
  try {
    details = statSync(path);
  } catch (error) {
    return {
      error: error && typeof error === "object" && "code" in error && error.code === "ENOENT"
        ? "missing"
        : "unreadable",
      files: [],
      isFile: false,
      path
    };
  }

  if (!details.isFile() && !details.isDirectory()) {
    return { error: "unsupported", files: [], isFile: false, path };
  }
  if (details.isFile() && !isDemoSourceFile(path)) {
    return { error: "unsupported", files: [], isFile: true, path };
  }

  let files;
  try {
    files = details.isFile() ? [path] : listDirectoryFiles(path);
    for (const file of files) readSource(file);
  } catch {
    return { error: "unreadable", files: [], isFile: details.isFile(), path };
  }

  if (files.length === 0) {
    return { error: "unexpected-empty", files, isFile: details.isFile(), path };
  }
  return { error: null, files, isFile: details.isFile(), path };
}

function isForbiddenIntegrationModule(specifier) {
  return specifier === "ai"
    || /(?:^|[/@_.-])(?:openai|anthropic|gemini|gateway|model)(?:$|[/@_.-])/iu.test(specifier);
}

function stringValue(node) {
  return ts.isStringLiteralLike(node) ? node.text : null;
}

function moduleSpecifier(node) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
    && node.moduleSpecifier !== undefined) {
    return stringValue(node.moduleSpecifier);
  }
  if (ts.isImportEqualsDeclaration(node)
    && ts.isExternalModuleReference(node.moduleReference)
    && node.moduleReference.expression !== undefined) {
    return stringValue(node.moduleReference.expression);
  }
  if (ts.isCallExpression(node)
    && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    && node.arguments.length > 0) {
    return stringValue(node.arguments[0]);
  }
  return null;
}

function integrationReceiverName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  return accessedName(expression);
}

function isForbiddenIntegrationCall(call) {
  if (!ts.isPropertyAccessExpression(call.expression)
    && !ts.isElementAccessExpression(call.expression)) return false;
  const method = accessedName(call.expression);
  const receiver = integrationReceiverName(call.expression.expression);
  return method !== null
    && /^(?:complete|generate|invoke|request|respond|run|send|stream)$/iu.test(method)
    && receiver !== null
    && /^(?:ai|model|gateway)(?:Client|Service|Api)?$/iu.test(receiver);
}

function isFetchReference(node) {
  if (ts.isIdentifier(node) && node.text === "fetch") {
    return !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node);
  }
  return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    && accessedName(node) === "fetch";
}

function integrationFindings(sourceFile, file, allowNetworkFetch = false) {
  const findings = [];
  const visit = (node) => {
    const specifier = moduleSpecifier(node);
    if (specifier !== null && isForbiddenIntegrationModule(specifier)) {
      findings.push({
        file,
        label: "AI/model/Gateway integration",
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      });
    }
    if (ts.isCallExpression(node) && isForbiddenIntegrationCall(node)) {
      findings.push({
        file,
        label: "AI/model/Gateway integration",
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      });
    }
    if (!allowNetworkFetch && isFetchReference(node)) {
      findings.push({
        file,
        label: "AI/model/Gateway integration",
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

function accessedName(expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression)
    && expression.argumentExpression !== undefined
    && (ts.isStringLiteralLike(expression.argumentExpression)
      || ts.isNumericLiteral(expression.argumentExpression))
  ) return expression.argumentExpression.text;
  return null;
}

function isStaticLogArgument(node) {
  return ts.isStringLiteralLike(node)
    || ts.isNumericLiteral(node)
    || ts.isBigIntLiteral(node)
    || ts.isRegularExpressionLiteral(node)
    || node.kind === ts.SyntaxKind.TrueKeyword
    || node.kind === ts.SyntaxKind.FalseKeyword
    || node.kind === ts.SyntaxKind.NullKeyword;
}

function isLoggerCall(call, sourceFile) {
  if (ts.isIdentifier(call.expression)) {
    return call.expression.text === "log" || /logger$/iu.test(call.expression.text);
  }
  if (!ts.isPropertyAccessExpression(call.expression) && !ts.isElementAccessExpression(call.expression)) {
    return false;
  }
  const method = accessedName(call.expression);
  if (method === null || !logMethods.has(method)) return false;
  const receiver = call.expression.expression.getText(sourceFile).replace(/\s/gu, "");
  return receiver === "console" || receiver === "log" || /logger$/iu.test(receiver);
}

function sensitiveLogFindings(sourceFile, file) {
  const findings = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node)
      && isLoggerCall(node, sourceFile)
      && node.arguments.some((argument) => !isStaticLogArgument(argument))
    ) {
      findings.push({
        file,
        label: "sensitive message/body logging",
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

function recordingFindings(sourceFile, file) {
  const lines = new Set();
  const visit = (node) => {
    const isAudioRecording = (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      && integrationReceiverName(node.expression) === "Audio"
      && accessedName(node) === "Recording";
    const isRecordingCreate = ts.isCallExpression(node)
      && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && integrationReceiverName(node.expression.expression) === "Recording"
      && accessedName(node.expression) === "createAsync";
    const isRecordingIdentifier = ts.isIdentifier(node)
      && (node.text === "startRecordingAsync" || node.text === "useAudioRecorder");
    const isComputedRecordingCall = ts.isCallExpression(node)
      && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
      && (accessedName(node.expression) === "startRecordingAsync"
        || accessedName(node.expression) === "useAudioRecorder");
    if (isAudioRecording || isRecordingCreate || isRecordingIdentifier || isComputedRecordingCall) {
      lines.add(sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...lines].map((line) => ({ file, label: "recording path", line }));
}

function readinessFindings(sourceFile, file) {
  const lines = new Set();
  const isReadinessName = (name) => name !== null
    && /^(?:readiness|readiness(?:Index|Percent|Percentage|Rating|Score)|(?:calculate|compute|derive)Readiness)$/iu.test(name);
  const visit = (node) => {
    const contextualProperty = (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      ? accessedName(node)
      : null;
    if ((ts.isIdentifier(node) && isReadinessName(node.text)) || isReadinessName(contextualProperty)) {
      lines.add(sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...lines].map((line) => ({ file, label: "readiness-score implementation", line }));
}

function isExplicitImageSavePhotoRequest(call, sourceFile) {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  if (call.expression.expression.getText(sourceFile) !== "MediaLibrary") return false;
  if (call.expression.name.text !== "requestPermissionsAsync") return false;
  if (call.arguments.length !== 2 || call.arguments[0].kind !== ts.SyntaxKind.TrueKeyword) return false;

  const permissions = call.arguments[1];
  if (
    !ts.isArrayLiteralExpression(permissions)
    || permissions.elements.length !== 1
    || !ts.isStringLiteral(permissions.elements[0])
    || permissions.elements[0].text !== "photo"
  ) return false;

  let owner = call.parent;
  while (owner !== undefined && !ts.isFunctionLike(owner)) owner = owner.parent;
  return owner !== undefined
    && ts.isFunctionDeclaration(owner)
    && owner.parent === sourceFile
    && owner.name?.text === "saveCardImageToLibrary"
    && owner.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) === true
    && owner.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.AsyncKeyword) === true;
}

function isPermissionReference(node) {
  if (ts.isIdentifier(node) && permissionMethods.has(node.text)) {
    return !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node);
  }
  return (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    && permissionMethods.has(accessedName(node));
}

function permissionFindings(sourceFile, file, isImageSaveAdapter) {
  const references = [];
  const visit = (node) => {
    if (isPermissionReference(node)) references.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const hasSoleExplicitImageSaveRequest = isImageSaveAdapter
    && references.length === 1
    && ts.isCallExpression(references[0].parent)
    && references[0].parent.expression === references[0]
    && isExplicitImageSavePhotoRequest(references[0].parent, sourceFile);
  if (hasSoleExplicitImageSaveRequest) return [];

  return references.map((reference) => ({
    file,
    label: "automatic permission request",
    line: sourceFile.getLineAndCharacterOfPosition(reference.getStart(sourceFile)).line + 1
  }));
}

const targetResults = targets.map(collectTarget);
const targetErrors = targetResults.filter(({ error }) => error !== null);
const files = [];
const seenFiles = new Set();

for (const target of targetResults) {
  for (const file of target.files) {
    const canonical = normalizePath(realpathSync(file));
    const key = process.platform === "win32" ? canonical.toLocaleLowerCase("en") : canonical;
    if (seenFiles.has(key)) continue;
    seenFiles.add(key);
    files.push(file);
  }
}

const findings = [];

for (const target of targetErrors) {
  process.stderr.write(`mobile source policy target failed: ${target.error} ${targetLabel(target.path)}\n`);
  process.exitCode = 1;
}

for (const file of files) {
  const source = readSource(file);
  const reportPath = normalizePath(relative(workspaceRoot, file)) || basename(file);
  const sourceFile = ts.createSourceFile(reportPath, source, ts.ScriptTarget.Latest, true);

  findings.push(...integrationFindings(
    sourceFile,
    reportPath,
    normalizePath(file).endsWith(authApiAdapter)
  ));
  findings.push(...recordingFindings(sourceFile, reportPath));

  findings.push(...permissionFindings(
    sourceFile,
    reportPath,
    normalizePath(file).endsWith(imageSaveAdapter)
  ));

  findings.push(...sensitiveLogFindings(sourceFile, reportPath));
  findings.push(...readinessFindings(sourceFile, reportPath));
}

if (findings.length > 0) {
  findings
    .sort((left, right) => left.file.localeCompare(right.file, "en")
      || left.line - right.line
      || left.label.localeCompare(right.label, "en"))
    .forEach((finding) => {
      process.stderr.write(`mobile source policy finding: ${finding.label} in ${finding.file}:${finding.line}\n`);
    });
  process.exitCode = 1;
} else if (files.length > 0 && targetErrors.length === 0) {
  process.stdout.write(`mobile source policy passed (${files.length} files)\n`);
}
