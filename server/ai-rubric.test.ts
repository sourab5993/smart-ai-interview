import { describe, expect, it } from "vitest";
import { parseJson, scoreEvidenceBackedDimensions } from "./ai";

describe("evidence-backed evaluation rubric", () => {
  it("keeps textual communication separate from answer-quality score", () => {
    const result = scoreEvidenceBackedDimensions(
      [
        {
          name: "Relevance",
          score: 80,
          note: "The response addressed the core question.",
          evidence: "I reduced errors by 20%",
        },
        {
          name: "Communication",
          score: 60,
          note: "The response used a clear sequence.",
          evidence: "I broke work into steps",
        },
      ],
      "I reduced errors by 20% by adding tests. I broke work into steps.",
      [
        { name: "Relevance", weight: 70 },
        { name: "Communication", weight: 30 },
      ]
    );

    expect(result.dimensions.map(dimension => dimension.weight)).toEqual([100, 100]);
    expect(result.dimensions.map(dimension => dimension.measure)).toEqual([
      "answer-quality",
      "communication",
    ]);
    expect(result.overallScore).toBe(80);
    expect(result.communicationScore).toBe(60);
    expect(result.dimensions.map(dimension => dimension.evidence)).toEqual([
      "I reduced errors by 20%",
      "I broke work into steps",
    ]);
  });

  it("refuses to score a dimension when its quotation is not an exact saved-answer substring", () => {
    expect(() =>
      scoreEvidenceBackedDimensions(
        [
          {
            name: "Completeness",
            score: 55,
            note: "A specific control was not named.",
            evidence: "I passed all compliance checks",
          },
        ],
        "I reviewed the checklist and documented the result.",
        [{ name: "Completeness", weight: 1 }]
      )
    ).toThrow("exact supporting answer evidence");
  });

  it("normalizes answer-quality and communication weights within their own measures", () => {
    const result = scoreEvidenceBackedDimensions(
      [
        { name: "Relevance", score: 30, note: "", evidence: "I answered" },
        { name: "Reasoning", score: 60, note: "", evidence: "I reasoned" },
        { name: "Communication", score: 90, note: "", evidence: "I explained" },
      ],
      "I answered directly. I reasoned through the options. I explained the result.",
      [
        { name: "Relevance", weight: 1 },
        { name: "Reasoning", weight: 1 },
        { name: "Communication", weight: 1 },
      ]
    );

    expect(result.dimensions.map(dimension => dimension.weight)).toEqual([50, 50, 100]);
    expect(result.overallScore).toBe(45);
    expect(result.communicationScore).toBe(90);
  });

  it("rejects duplicate dimension names rather than double-counting them", () => {
    expect(() =>
      scoreEvidenceBackedDimensions(
        [
          { name: "Relevance", score: 80, note: "", evidence: "answer" },
          { name: "relevance", score: 90, note: "", evidence: "answer" },
        ],
        "answer",
        [{ name: "Relevance", weight: 1 }]
      )
    ).toThrow("duplicate or empty rubric dimensions");
  });

  it("rejects a model-invented dimension even when it provides an exact quotation", () => {
    expect(() =>
      scoreEvidenceBackedDimensions(
        [
          {
            name: "Confidence",
            score: 90,
            note: "The answer was confident.",
            evidence: "I tested the change",
          },
        ],
        "I tested the change and recorded the result.",
        [{ name: "Relevance", weight: 1 }]
      )
    ).toThrow("outside the configured rubric");
  });

  it("discards a configured confidence trait and does not include it in answer or communication scores", () => {
    const result = scoreEvidenceBackedDimensions(
      [
        { name: "Relevance", score: 75, note: "", evidence: "I tested the change" },
        { name: "Confidence", score: 99, note: "", evidence: "I tested the change" },
      ],
      "I tested the change and recorded the result.",
      [
        { name: "Relevance", weight: 1 },
        { name: "Confidence", weight: 1 },
      ]
    );

    expect(result.overallScore).toBe(75);
    expect(result.communicationScore).toBeNull();
    expect(result.dimensions.map(dimension => dimension.name)).toEqual(["Relevance"]);
  });

  it("scales 0-10 rubric scores to 0-100 when declaredScale is 0-10 or low rubric integers are returned", () => {
    const result = scoreEvidenceBackedDimensions(
      [
        {
          name: "Relevance",
          score: 8,
          note: "Good domain relevance.",
          evidence: "I used React and TypeScript",
        },
        {
          name: "Problem Solving",
          score: 7,
          note: "Clear solution approach.",
          evidence: "I resolved the memory leak",
        },
      ],
      "In the project I used React and TypeScript. I resolved the memory leak by cleaning up listeners.",
      [
        { name: "Relevance", weight: 50 },
        { name: "Problem Solving", weight: 50 },
      ],
      "0-10"
    );

    expect(result.overallScore).toBe(75);
    expect(result.dimensions[0].score).toBe(80);
    expect(result.dimensions[1].score).toBe(70);
  });

  it("preserves 0-100 scale scores without double-scaling", () => {
    const result = scoreEvidenceBackedDimensions(
      [
        {
          name: "Relevance",
          score: 85,
          note: "Strong relevance.",
          evidence: "I optimized database queries",
        },
      ],
      "I optimized database queries to reduce p99 latency.",
      [{ name: "Relevance", weight: 1 }],
      "0-100"
    );

    expect(result.overallScore).toBe(85);
    expect(result.dimensions[0].score).toBe(85);
  });

  it("matches evidence with smart quotes and collapsed whitespace while still rejecting fabricated quotes", () => {
    const result = scoreEvidenceBackedDimensions(
      [
        {
          name: "Relevance",
          score: 80,
          note: "Accurate quote with curly quotes.",
          evidence: '"strict mode" helped catch bugs',
        },
      ],
      'Using “strict mode”  helped catch bugs early.',
      [{ name: "Relevance", weight: 1 }]
    );

    expect(result.overallScore).toBe(80);
    expect(() =>
      scoreEvidenceBackedDimensions(
        [
          {
            name: "Relevance",
            score: 80,
            note: "Fabricated quote.",
            evidence: "completely fabricated sentence",
          },
        ],
        'Using “strict mode”  helped catch bugs early.',
        [{ name: "Relevance", weight: 1 }]
      )
    ).toThrow("exact supporting answer evidence");
  });

  describe("safe Gemini JSON parsing", () => {
    it("preserves commas, quotation marks, and curly quotes inside string contents", () => {
      const raw = `{"text": "Item 1, and } item 2", "quote": "He said \\"hello\\" and 'goodbye'", "curly": "“smart quotes”", "trailing": 42, }`;
      const parsed = parseJson(raw) as any;
      expect(parsed.text).toBe("Item 1, and } item 2");
      expect(parsed.quote).toBe('He said "hello" and \'goodbye\'');
      expect(parsed.curly).toBe("“smart quotes”");
      expect(parsed.trailing).toBe(42);
    });

    it("handles markdown code fences and conversational wrappers", () => {
      const wrapped =
        "Here is the response:\n```json\n{\"score\": 85, \"items\": [1, 2, ], }\n```\nHope this helps!";
      const parsed = parseJson(wrapped) as any;
      expect(parsed.score).toBe(85);
      expect(parsed.items).toEqual([1, 2]);
    });

    it("rejects invalid, malformed or empty responses safely", () => {
      expect(() => parseJson("")).toThrow("The AI returned no usable text.");
      expect(() => parseJson("   ")).toThrow("The AI returned no usable text.");
      expect(() => parseJson(null)).toThrow("The AI returned no usable text.");
      expect(() => parseJson("Not JSON at all")).toThrow(
        "The AI response was not valid JSON."
      );
    });
  });
});
