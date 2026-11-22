import { describe, expect, it } from "vitest";
import {
  normalizeScore,
  safeAverageScore,
  formatScore,
  canonicalDimensionName,
  CANONICAL_DIMENSIONS,
} from "../shared/scoring";
import { scoreEvidenceBackedDimensions } from "./ai";

describe("score normalization and contract enforcement", () => {
  describe("normalizeScore", () => {
    it("preserves valid 0-100 score when declared scale is 0-100 or undeclared", () => {
      expect(normalizeScore(85, "0-100")).toBe(85);
      expect(normalizeScore(100, "0-100")).toBe(100);
      expect(normalizeScore(65)).toBe(65);
      expect(normalizeScore("72", "0-100")).toBe(72);
    });

    it("normalizes explicit 0-10 score to 0-100", () => {
      expect(normalizeScore(8, "0-10")).toBe(80);
      expect(normalizeScore(7.5, "0-10")).toBe(75);
      expect(normalizeScore(10, "0-10")).toBe(100);
      expect(normalizeScore(0, "0-10")).toBe(0);
      expect(normalizeScore("9", "0-10")).toBe(90);
    });

    it("preserves genuine score of 0 as zero, distinct from null/unevaluated", () => {
      expect(normalizeScore(0)).toBe(0);
      expect(normalizeScore(0, "0-100")).toBe(0);
      expect(normalizeScore("0")).toBe(0);
      expect(normalizeScore(0)).not.toBeNull();
    });

    it("returns null for unevaluated, missing, empty, or non-numeric values", () => {
      expect(normalizeScore(null)).toBeNull();
      expect(normalizeScore(undefined)).toBeNull();
      expect(normalizeScore("")).toBeNull();
      expect(normalizeScore("N/A")).toBeNull();
      expect(normalizeScore(NaN)).toBeNull();
    });

    it("rejects out-of-bounds scores as malformed", () => {
      expect(normalizeScore(-5)).toBeNull();
      expect(normalizeScore(105)).toBeNull();
      expect(normalizeScore(15, "0-10")).toBeNull();
      expect(normalizeScore(-1, "0-10")).toBeNull();
    });

    it("safely rounds decimal scores", () => {
      expect(normalizeScore(84.6)).toBe(85);
      expect(normalizeScore(84.2)).toBe(84);
      expect(normalizeScore(8.44, "0-10")).toBe(84);
    });
  });

  describe("safeAverageScore", () => {
    it("computes average across valid numeric scores", () => {
      expect(safeAverageScore([80, 90, 100])).toBe(90);
      expect(safeAverageScore([70, 80])).toBe(75);
    });

    it("safely filters out null, undefined and invalid entries without treating them as 0", () => {
      expect(safeAverageScore([80, null, 100, undefined])).toBe(90);
      expect(safeAverageScore([70, "invalid", 90])).toBe(80);
    });

    it("returns null when no valid scores exist, never defaulting to fake 0", () => {
      expect(safeAverageScore([])).toBeNull();
      expect(safeAverageScore([null, undefined, ""])).toBeNull();
    });

    it("includes genuine 0 score in average calculation", () => {
      // 0 and 100 average to 50
      expect(safeAverageScore([0, 100])).toBe(50);
    });
  });

  describe("formatScore", () => {
    it("formats valid score with percentage suffix", () => {
      expect(formatScore(85)).toBe("85%");
      expect(formatScore(0)).toBe("0%");
      expect(formatScore(100)).toBe("100%");
    });

    it("formats custom suffix", () => {
      expect(formatScore(85, "/100")).toBe("85/100");
    });

    it("returns fallback for unevaluated/null scores", () => {
      expect(formatScore(null)).toBe("—");
      expect(formatScore(undefined)).toBe("—");
      expect(formatScore("")).toBe("—");
      expect(formatScore(null, "%", "Not scored")).toBe("Not scored");
    });
  });

  describe("canonicalDimensionName", () => {
    it("recognizes all canonical dimensions and synonyms", () => {
      expect(canonicalDimensionName("Technical Correctness").canonical).toBe(
        "Technical Correctness"
      );
      expect(canonicalDimensionName("Technical Accuracy").canonical).toBe(
        "Technical Correctness"
      );
      expect(canonicalDimensionName("Domain Knowledge").canonical).toBe(
        "Technical Correctness"
      );

      expect(canonicalDimensionName("Relevance").canonical).toBe("Relevance");
      expect(canonicalDimensionName("Topic Relevance").canonical).toBe(
        "Relevance"
      );

      expect(canonicalDimensionName("Completeness").canonical).toBe(
        "Completeness"
      );

      expect(canonicalDimensionName("Problem Solving").canonical).toBe(
        "Problem-solving Ability"
      );
      expect(
        canonicalDimensionName("Problem-solving Ability").canonical
      ).toBe("Problem-solving Ability");

      expect(canonicalDimensionName("Communication").canonical).toBe(
        "Communication and Clarity"
      );
      expect(canonicalDimensionName("Clarity").canonical).toBe(
        "Communication and Clarity"
      );
    });

    it("correctly assigns measure type", () => {
      expect(canonicalDimensionName("Communication").measure).toBe(
        "communication"
      );
      expect(canonicalDimensionName("Technical Accuracy").measure).toBe(
        "answer-quality"
      );
      expect(canonicalDimensionName("Relevance").measure).toBe("answer-quality");
    });
  });

  describe("scoreEvidenceBackedDimensions with canonical mapping", () => {
    it("resolves canonical dimension synonyms seamlessly", () => {
      const answer = "I designed an idempotent API with token deduplication.";
      const result = scoreEvidenceBackedDimensions(
        [
          {
            name: "Technical Accuracy",
            score: 85,
            note: "Strong system design concept.",
            evidence: "idempotent API with token deduplication",
          },
          {
            name: "Communication",
            score: 75,
            note: "Clear and direct.",
            evidence: "I designed an idempotent API",
          },
        ],
        answer,
        [
          { name: "Technical Correctness", weight: 80 },
          { name: "Communication and Clarity", weight: 20 },
        ]
      );

      expect(result.overallScore).toBe(85);
      expect(result.communicationScore).toBe(75);
      expect(result.dimensions.length).toBe(2);
    });

    it("preserves genuine score 0 when candidate answers poorly", () => {
      const answer = "I have no idea about this topic.";
      const result = scoreEvidenceBackedDimensions(
        [
          {
            name: "Technical Correctness",
            score: 0,
            note: "Candidate did not know the topic.",
            evidence: "I have no idea about this topic.",
          },
        ],
        answer,
        [{ name: "Technical Correctness", weight: 100 }]
      );

      expect(result.overallScore).toBe(0);
      expect(result.overallScore).not.toBeNull();
    });
  });
});
