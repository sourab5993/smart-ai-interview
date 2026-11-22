import { describe, expect, it } from "vitest";
import { completionAdjustedScore } from "../client/src/lib/scoring";
import { isSilenceHallucination } from "../shared/scoring";

describe("isSilenceHallucination", () => {
  it("flags empty, whitespace, and punctuation-only text as silence hallucinations", () => {
    expect(isSilenceHallucination("")).toBe(true);
    expect(isSilenceHallucination("   ")).toBe(true);
    expect(isSilenceHallucination("...")).toBe(true);
    expect(isSilenceHallucination(null)).toBe(true);
    expect(isSilenceHallucination(undefined)).toBe(true);
  });

  it("identifies known silence and background static hallucinations", () => {
    expect(isSilenceHallucination("Where is a hospital in this city?")).toBe(true);
    expect(isSilenceHallucination("where is the hospital in this city")).toBe(true);
    expect(isSilenceHallucination("Where is the nearest hospital?")).toBe(true);
    expect(isSilenceHallucination("Thank you for watching!")).toBe(true);
    expect(isSilenceHallucination("Thanks for watching")).toBe(true);
    expect(isSilenceHallucination("Please subscribe to my channel")).toBe(true);
    expect(isSilenceHallucination("Subtitles by Amara.org")).toBe(true);
  });

  it("does not flag legitimate interview answers", () => {
    expect(
      isSilenceHallucination(
        "I would first clarify the API requirements and data access patterns."
      )
    ).toBe(false);
    expect(
      isSilenceHallucination(
        "We can use a distributed hash table or Redis caching layer."
      )
    ).toBe(false);
  });
});

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
