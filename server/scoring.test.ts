import { describe, expect, it } from "vitest";
import { completionAdjustedScore } from "../client/src/lib/scoring";

describe("completion-adjusted interview scores", () => {
  it("accounts for unanswered questions", () => {
    expect(completionAdjustedScore(45, 1, 5)).toBe(9);
  });

  it("preserves answer quality for a complete interview", () => {
    expect(completionAdjustedScore(45, 5, 5)).toBe(45);
  });

  it("clamps invalid counts and quality safely", () => {
    expect(completionAdjustedScore(120, 9, 5)).toBe(100);
    expect(completionAdjustedScore(-10, 0, 5)).toBe(0);
  });
});
