import { StringDecoder } from "node:string_decoder";

/** Collect configured resource identifiers, including nested environment bindings. */
export function collectResourceIdentifiers(config) {
  const identifiers = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (/^(?:id|.+_ids?)$/iu.test(key) && typeof entry === "string") {
        for (const identifier of entry.split(/[\s,]+/u)) {
          if (identifier && identifier !== "*") identifiers.add(identifier);
        }
      }
      visit(entry);
    }
  };
  visit(config);
  return [...identifiers].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

export function redactResourceIdentifiers(text, identifiers) {
  return identifiers.reduce((redacted, identifier) => identifier
    ? redacted.replaceAll(identifier, "[redacted-resource-id]") : redacted, text);
}

/** Hold incomplete lines so an identifier split across stdout chunks cannot leak. */
export function createRedactedLineWriter(write, identifiers) {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let ended = false;
  const emitLines = () => {
    let newline;
    while ((newline = pending.indexOf("\n")) !== -1) {
      write(redactResourceIdentifiers(pending.slice(0, newline + 1), identifiers));
      pending = pending.slice(newline + 1);
    }
  };
  return {
    write(chunk) {
      if (ended) throw new Error("Redacted output stream has ended");
      pending += typeof chunk === "string" ? chunk : decoder.write(chunk);
      emitLines();
    },
    end() {
      if (ended) return;
      ended = true;
      pending += decoder.end();
      emitLines();
      if (pending) write(redactResourceIdentifiers(pending, identifiers));
      pending = "";
    },
  };
}

export function githubMaskCommands(identifiers) {
  // Escape command data rather than allowing a value to create another command.
  return identifiers.map(value => `::add-mask::${value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}\n`).join("");
}
