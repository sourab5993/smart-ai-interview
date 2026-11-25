// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReportMetrics } from "./InterviewPages";

describe("useReportMetrics", () => {
  it("calculates evaluated count, score, and radar dimensions when answers have AI evaluations", () => {
    const answers = [
      {
        id: "q1",
        question_text: "What is React reconciliation?",
        answer: "It is the diffing algorithm used by React to update the DOM efficiently.",
        evaluation: {
          overall_score: 86,
          source: "ai",
          dimensions: [
            { name: "Technical Correctness", score: 90 },
            { name: "Clarity", score: 82 },
          ],
          strengths: ["Clear explanation of diffing"],
          weaknesses: ["Could mention Fiber"],
        },
      },
      {
        id: "q2",
        question_text: "Explain closures in JavaScript.",
        answer: "A closure gives you access to an outer function's scope from an inner function.",
        evaluation: {
          overall_score: 80,
          source: "ai",
          dimensions: [
            { name: "Technical Correctness", score: 85 },
            { name: "Clarity", score: 75 },
          ],
          strengths: ["Accurate definition"],
          weaknesses: [],
        },
      },
    ];

    const report = {
      analysisSource: "ai",
      summary: "Strong performance across core frontend topics.",
    };

    const session = {
      id: "session-1",
      overall_score: 83,
    } as any;

    const { result } = renderHook(() =>
      useReportMetrics(answers, report, session, [])
    );

    expect(result.current.evaluated.length).toBe(2);
    expect(result.current.answeredCount).toBe(2);
    expect(result.current.answerQuality).toBe(83);
    expect(result.current.score).toBe(83);
    expect(result.current.radar.length).toBe(2);

    const techDim = result.current.radar.find(r => r.subject === "Technical Correctness");
    expect(techDim).toBeDefined();
    expect(techDim?.score).toBe(88); // Math.round((90 + 85) / 2)
  });

  it("falls back to performanceMetrics for radar dimensions when answers have no dimension data", () => {
    const answers = [
      {
        id: "q1",
        question_text: "Q1",
        answer: "Answer 1",
        evaluation: {
          overall_score: 80,
          source: "ai",
          dimensions: [],
        },
      },
    ];

    const performanceMetrics = [
      { metric_name: "Problem Solving", metric_value: 85 },
      { metric_name: "Communication", metric_value: 78 },
    ];

    const { result } = renderHook(() =>
      useReportMetrics(answers, null, null, performanceMetrics)
    );

    expect(result.current.radar.length).toBe(2);
    expect(result.current.radar.find(r => r.subject === "Problem Solving")?.score).toBe(85);
    expect(result.current.radar.find(r => r.subject === "Communication")?.score).toBe(78);
  });

  it("uses session.overall_score as resilient fallback when no evaluations are available", () => {
    const answers = [
      {
        id: "q1",
        question_text: "Q1",
        answer: "Answer 1",
        evaluation: null,
      },
    ];

    const session = {
      id: "session-1",
      overall_score: 77,
    } as any;

    const { result } = renderHook(() =>
      useReportMetrics(answers, null, session, [])
    );

    expect(result.current.evaluated.length).toBe(0);
    expect(result.current.score).toBe(77);
  });
});
