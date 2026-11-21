import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ai", () => ({
  AI_MODEL: "gemini-3-flash-preview",
  analyzeInterview: vi.fn(),
  evaluateAnswer: vi.fn(),
  generateQuestions: vi.fn(),
}));

import { AI_MODEL, generateQuestions } from "./ai";
import { scheduledWorkAdapters } from "./scheduled-work-adapters";

const mockGenerateQuestions = vi.mocked(generateQuestions);

describe("daily Gemini question-bank adapter", () => {
  beforeEach(() => {
    mockGenerateQuestions.mockReset();
    mockGenerateQuestions.mockImplementation(async input => {
      const requested = input.context?.match(/Return exactly (\d+) distinct questions/);
      const order = input.context?.match(/Requested difficulty labels in order: ([^.]+)/);
      const count = Number(requested?.[1] || 0);
      const difficulties = (order?.[1] || "").split(", ");
      return {
        source: "ai",
        modelVersion: AI_MODEL,
        promptVersion: "test-question-prompt-v1",
        questions: Array.from({ length: count }, (_, index) => ({
          question: `For ${input.role} in ${input.course}, describe how you would investigate role-specific scenario ${index + 1} and verify the outcome.`,
          topic: "Role competency",
          difficulty: difficulties[index],
          rationale: "Tests evidence-led application of the stated role competency.",
        })),
      };
    });
  });

  it("creates 24 original questions across canonical categories and all three difficulties", async () => {
    const questions = await scheduledWorkAdapters.generateQuestions({
      count: 24,
      model: AI_MODEL,
    });

    expect(questions).toHaveLength(24);
    expect(new Set(questions.map(question => question.category)).size).toBe(12);
    expect(questions.map(question => question.difficulty).sort()).toEqual(
      [...Array(8).fill("Easy"), ...Array(8).fill("Hard"), ...Array(8).fill("Medium")].sort()
    );
    expect(new Set(questions.map(question => question.questionCategory))).toEqual(
      new Set(["Basic", "Application-based", "Scenario-based"])
    );
    expect(questions.every(question => question.interviewType === "Domain")).toBe(true);
    expect(questions.some(question => question.category === "engineering")).toBe(true);
    expect(questions.some(question => question.category === "hospitality")).toBe(true);
    expect(mockGenerateQuestions).toHaveBeenCalledTimes(15);
    expect(mockGenerateQuestions.mock.calls.every(([input]) => input.type === "Domain")).toBe(true);
  });

  it("rejects an unsupported model and an unbounded batch before calling AI", async () => {
    await expect(
      scheduledWorkAdapters.generateQuestions({ count: 24, model: "not-a-gemini-model" })
    ).rejects.toThrow("unsupported model");
    await expect(
      scheduledWorkAdapters.generateQuestions({ count: 5, model: AI_MODEL })
    ).rejects.toThrow("safe bound");
    expect(mockGenerateQuestions).not.toHaveBeenCalled();
  });
});
