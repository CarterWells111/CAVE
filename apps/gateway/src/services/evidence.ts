import {
  DebriefDimensionSchema,
  type DebriefDimension,
  type DebriefKey,
  type PracticeTurn
} from "@cave/contracts";
import { z } from "zod";

const DIMENSION_ORDER: readonly DebriefKey[] = [
  "feeling",
  "willingness",
  "boundary",
  "next_step"
];

export function quoteAppearsInUserTurn(
  quote: string,
  turns: readonly PracticeTurn[]
): boolean {
  const normalizedQuote = quote.normalize("NFC");
  return turns.some(
    (turn) =>
      turn.role === "user" && turn.text.normalize("NFC").includes(normalizedQuote)
  );
}

export function normalizeDebriefDimensions(
  candidate: unknown,
  turns: readonly PracticeTurn[]
): DebriefDimension[] {
  const dimensions = z.array(DebriefDimensionSchema).parse(candidate);
  const keys = dimensions.map((dimension) => dimension.key);
  const uniqueKeys = new Set(keys);

  if (
    dimensions.length !== DIMENSION_ORDER.length ||
    uniqueKeys.size !== DIMENSION_ORDER.length ||
    DIMENSION_ORDER.some((key) => !uniqueKeys.has(key))
  ) {
    throw new Error("Debrief dimensions must contain each required key exactly once");
  }

  const byKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  return DIMENSION_ORDER.map((key) => {
    const dimension = byKey.get(key);
    if (!dimension) {
      throw new Error("Debrief dimensions are incomplete");
    }
    const hasValidEvidence =
      dimension.evidenceQuote !== undefined &&
      quoteAppearsInUserTurn(dimension.evidenceQuote, turns);
    if (dimension.status !== "not_observed" && hasValidEvidence) {
      return dimension;
    }

    const sanitized = { ...dimension };
    delete sanitized.evidenceQuote;
    return {
      ...sanitized,
      status: "not_observed"
    };
  });
}
