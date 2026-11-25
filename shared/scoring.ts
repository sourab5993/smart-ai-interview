export const SILENCE_HALLUCINATION_PATTERNS = [
  /where is (a|the) hospital in this city/i,
  /where is the nearest hospital/i,
  /in the city,? (there are )?many people/i,
  /there are many people in the city/i,
  /the computer'?s on the table/i,
  /thank you for watching/i,
  /thanks for watching/i,
  /please subscribe/i,
  /subtitles by/i,
  /closed captions by/i,
  /amara\.org/i,
  /translated by/i,
  /transcript by/i,
];

/**
 * Checks if a transcribed string is an empty string, pure punctuation,
 * or a known silence/static hallucination produced by STT engines on silent audio.
 */
export function isSilenceHallucination(text: unknown): boolean {
  if (typeof text !== "string" || !text.trim()) return true;
  const trimmed = text.trim();
  const stripped = trimmed.replace(/^["'“‘\s.,;:!?]+|["'”’\s.,;:!?]+$/g, "");
  if (!stripped) return true;
  for (const pattern of SILENCE_HALLUCINATION_PATTERNS) {
    if (pattern.test(trimmed) || pattern.test(stripped)) {
      return true;
    }
  }
  return false;
}

export type ScoreScale = "0-100" | "0-10" | string | null | undefined;

export const CANONICAL_DIMENSIONS = [
  "Technical Correctness",
  "Relevance",
  "Completeness",
  "Problem-solving Ability",
  "Communication and Clarity",
] as const;

export type CanonicalDimension = (typeof CANONICAL_DIMENSIONS)[number];

export interface CanonicalDimensionInfo {
  canonical: CanonicalDimension | string;
  measure: "answer-quality" | "communication";
  defaultWeight: number;
}

/**
 * Maps any raw dimension string (or synonym) to a canonical dimension structure.
 */
export function canonicalDimensionName(rawName: string): CanonicalDimensionInfo {
  const norm = (rawName || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  if (/communication|clarity|fluency|grammar|articulation|structure|verbal/i.test(norm)) {
    return {
      canonical: "Communication and Clarity",
      measure: "communication",
      defaultWeight: 15,
    };
  }
  if (/relevance|topic|intent|prompt/i.test(norm)) {
    return {
      canonical: "Relevance",
      measure: "answer-quality",
      defaultWeight: 20,
    };
  }
  if (/technical|accuracy|correctness|domain|knowledge|concept|subject/i.test(norm)) {
    return {
      canonical: "Technical Correctness",
      measure: "answer-quality",
      defaultWeight: 25,
    };
  }
  if (/problem|solving|reasoning|analysis|logic|solution|approach|critical/i.test(norm)) {
    return {
      canonical: "Problem-solving Ability",
      measure: "answer-quality",
      defaultWeight: 20,
    };
  }
  if (/complete|coverage|depth|thorough/i.test(norm)) {
    return {
      canonical: "Completeness",
      measure: "answer-quality",
      defaultWeight: 20,
    };
  }
  return {
    canonical: rawName.trim() || "Technical Correctness",
    measure: "answer-quality",
    defaultWeight: 20,
  };
}

/**
 * Normalizes an answer or interview score to a canonical 0-100 scale.
 *
 * Rules:
 * - If rawScore is null, undefined, empty, or not a finite number, returns null.
 * - If declaredScale is "0-10": rawScore must be within [0, 10]; returns Math.round(rawScore * 10).
 * - If declaredScale is "0-100" or undeclared: rawScore must be within [0, 100]; returns Math.round(rawScore).
 * - If rawScore is negative or >100, returns null (rejected as malformed).
 * - A genuine score of 0 returns 0 (not null).
 * - An unevaluated answer or missing score returns null.
 */
export function normalizeScore(
  rawScore: unknown,
  declaredScale?: ScoreScale
): number | null {
  if (rawScore === null || rawScore === undefined || rawScore === "") {
    return null;
  }
  const num = typeof rawScore === "number" ? rawScore : Number(rawScore);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return null;
  }

  // Explicit 0-10 scale
  if (declaredScale === "0-10") {
    if (num < 0 || num > 10) return null;
    return Math.round(Math.max(0, Math.min(100, num * 10)));
  }

  // Explicit 0-100 scale or undeclared scale
  if (declaredScale === "0-100" || !declaredScale) {
    if (num < 0 || num > 100) return null;
    return Math.round(Math.max(0, Math.min(100, num)));
  }

  // Unknown declared scale: if outside 0-100, reject
  if (num < 0 || num > 100) return null;
  return Math.round(Math.max(0, Math.min(100, num)));
}

/**
 * Computes average of only valid evaluated scores.
 * Returns null if no scores are valid (never returns a fake 0).
 */
export function safeAverageScore(scores: Array<unknown>): number | null {
  const valid = scores
    .map(s => normalizeScore(s))
    .filter((s): s is number => s !== null);
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, s) => sum + s, 0) / valid.length);
}

/**
 * Formats a score for presentation.
 * Returns fallback (default "—") if score is null or unevaluated.
 */
export function formatScore(
  score: unknown,
  suffix = "%",
  fallback = "—"
): string {
  const norm = normalizeScore(score);
  if (norm === null) return fallback;
  return `${norm}${suffix}`;
}
