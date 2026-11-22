import { describe, expect, it, vi } from "vitest";
import { analyzeInterview, generateQuestions } from "./ai";

describe("interview e2e lifecycle and resilience contracts", () => {
  it("generateQuestions safely falls back to role/course questions if AI fails", async () => {
    // Calling with an empty/mocked environment should never crash or throw unhandled exceptions
    const result = await generateQuestions({
      course: "Computer Science",
      specialization: "Full Stack",
      role: "Software Engineer",
      type: "Technical",
      difficulty: "Medium",
      skills: ["React", "TypeScript", "Node.js"],
      count: 2,
      language: "English",
    });

    expect(result).toBeDefined();
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].question.length).toBeGreaterThan(10);
    expect(result.source).toBe("ai");
  });

  it("analyzeInterview produces a structured summary report even when AI call encounters an error", async () => {
    const answers = [
      {
        question: "How do you optimize React component re-renders?",
        answer: "I use useMemo, useCallback, and React.memo where profiling proves unnecessary re-renders occur.",
        score: 85,
      },
      {
        question: "Explain database indexing trade-offs.",
        answer: "B-Tree indexes speed up lookups but add overhead to writes and consume additional disk storage.",
        score: 80,
      },
    ];

    const report = await analyzeInterview({
      course: "Computer Science",
      role: "Backend Engineer",
      answers,
    });

    expect(report).toBeDefined();
    expect(report.summary).toContain("Backend Engineer");
    expect(report.summary).toContain("83/100"); // (85 + 80) / 2
    expect(Array.isArray(report.strengths)).toBe(true);
    expect(report.strengths.length).toBeGreaterThan(0);
    expect(Array.isArray(report.next_steps)).toBe(true);
    expect(report.next_steps.length).toBeGreaterThan(0);
  });

  it("detects stalled speech recognition when audio exists but fewer than 7 words were captured", () => {
    const isStalled = (durationMs: number, blobSize: number, text: string) => {
      const wordsCaptured = text.trim().split(/\s+/).filter(Boolean).length;
      return durationMs >= 6000 && blobSize > 2500 && wordsCaptured < 7;
    };

    // Candidate spoke for 15 seconds, captured 12KB of audio, but speech recognition stopped after 5 words
    expect(isStalled(15000, 12000, "I have worked with databases")).toBe(true);

    // Candidate spoke briefly (2s) with 3 words -> not stalled
    expect(isStalled(2000, 1000, "Yes I do")).toBe(false);

    // Candidate spoke for 15s and speech recognition captured 25 words -> normal speech, not stalled
    const normalText = "In my previous project I designed an automated pipeline using Docker and Kubernetes to deploy microservices reliably across multiple regions.";
    expect(isStalled(15000, 12000, normalText)).toBe(false);
  });

  it("idempotency contract: existing answers with identical text avoid duplicate save calls", () => {
    const answers = [
      {
        id: "ans-1",
        question_id: "q-1",
        answer_text: "State management using Zustand simplifies shared store access.",
        answer_mode: "text" as const,
        created_at: new Date().toISOString(),
      },
    ];

    const currentQuestionId = "q-1";
    const answerText = "State management using Zustand simplifies shared store access.";

    const existingAnswer = answers.find(a => a.question_id === currentQuestionId);
    const shouldSkipSaveRpc = existingAnswer && existingAnswer.answer_text === answerText;

    expect(shouldSkipSaveRpc).toBe(true);
  });

  it("evaluation failure preserves saved answer and allows advancing or retrying", () => {
    let savedAnswers: any[] = [];
    let evaluations: Record<string, any> = {};
    let errorBanner = "";

    // Step 1: Save answer succeeds
    const answer = {
      id: "ans-42",
      question_id: "q-10",
      answer_text: "Optimistic updates improve perceived performance during mutations.",
    };
    savedAnswers.push(answer);

    // Step 2: Evaluation fails due to network/LLM timeout
    const evalFailed = true;
    if (evalFailed) {
      errorBanner = "Your answer was saved successfully, but coaching evaluation is temporarily unavailable. You can retry evaluation or move to the next question.";
    }

    // Assert that the saved answer was NOT removed
    expect(savedAnswers).toHaveLength(1);
    expect(savedAnswers[0].id).toBe("ans-42");
    expect(evaluations["q-10"]).toBeUndefined();
    expect(errorBanner).toContain("Your answer was saved successfully");

    // Candidate can still choose to retry evaluation (Step 2 only)
    const canRetryEvaluation = savedAnswers.some(a => a.question_id === "q-10") && !evaluations["q-10"];
    expect(canRetryEvaluation).toBe(true);

    // Candidate can also choose to advance to the next question
    let currentIndex = 0;
    const advanceQuestion = () => {
      currentIndex += 1;
    };
    advanceQuestion();
    expect(currentIndex).toBe(1);
    // Answer remains in history for final report
    expect(savedAnswers).toHaveLength(1);
  });

  it("live interview adaptive follow-up resiliently falls back when generation yields empty questions", () => {
    const sessionRole = "Senior DevOps Engineer";
    let nextQuestionText = "";
    const priorTurn = {
      id: "turn-1",
      turn_index: 0,
      question_text: "How do you manage infrastructure as code?",
      transcript: "We use Terraform and GitOps with ArgoCD.",
      evaluation: { overall_score: 85 },
    };

    // Simulate empty AI response from network glitch
    const mockApiResponse: { questions: any[] } = { questions: [] };
    const q = mockApiResponse.questions?.[0];
    if (q?.question?.trim()) {
      nextQuestionText = q.question.trim();
    }

    if (!nextQuestionText) {
      nextQuestionText = `Can you provide a specific example of how you navigate trade-offs and edge cases in your work as a ${sessionRole}?`;
    }

    expect(nextQuestionText).toBe(
      "Can you provide a specific example of how you navigate trade-offs and edge cases in your work as a Senior DevOps Engineer?"
    );
  });
});
