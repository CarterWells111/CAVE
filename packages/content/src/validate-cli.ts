import { loadCatalog } from "./load";
import {
  ContentValidationError,
  validateCatalog,
  type ContentValidationMode
} from "./validate";

function readMode(): ContentValidationMode {
  const modeIndex = process.argv.indexOf("--mode");
  return process.argv[modeIndex + 1] === "draft" ? "draft" : "production";
}

try {
  const mode = readMode();
  const catalog = validateCatalog(loadCatalog(), { mode });
  console.log(
    `content validation passed (${mode}): ${catalog.courses.length} course(s), ${catalog.lessons.length} lesson(s), ${catalog.scenarios.length} scenario(s)`
  );
} catch (error) {
  if (error instanceof ContentValidationError) {
    for (const issue of error.issues) {
      console.error(`${issue.code} ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
  } else {
    throw error;
  }
}
