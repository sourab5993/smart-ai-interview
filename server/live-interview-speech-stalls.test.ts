import { describe, expect, it } from "vitest";

describe("live interview speech stalled detection and audio fallback logic", () => {
  function shouldFallbackToAudioTranscription(input: {
    durationMs: number;
    audioBlobSize: number;
    wordCount: number;
  }) {
    const recognitionStalled =
      input.durationMs >= 6000 &&
      input.audioBlobSize > 2500 &&
      input.wordCount < 7;
    const noLiveText = input.wordCount === 0;
    return (recognitionStalled || noLiveText) && input.audioBlobSize > 800;
  }

  it("detects when speech recognition stalled after 60s of speaking with only 5 words captured", () => {
    const result = shouldFallbackToAudioTranscription({
      durationMs: 58000,
      audioBlobSize: 75000,
      wordCount: 5,
    });
    expect(result).toBe(true);
  });

  it("does not trigger audio fallback when speech recognition successfully captured a 40-word answer", () => {
    const result = shouldFallbackToAudioTranscription({
      durationMs: 45000,
      audioBlobSize: 60000,
      wordCount: 40,
    });
    expect(result).toBe(false);
  });

  it("triggers audio fallback when candidate spoke for 10s but 0 words were recognized", () => {
    const result = shouldFallbackToAudioTranscription({
      durationMs: 10000,
      audioBlobSize: 12000,
      wordCount: 0,
    });
    expect(result).toBe(true);
  });

  it("does not trigger audio fallback for very short non-speech clicks (< 800 bytes)", () => {
    const result = shouldFallbackToAudioTranscription({
      durationMs: 1500,
      audioBlobSize: 400,
      wordCount: 0,
    });
    expect(result).toBe(false);
  });
});

describe("live interview setup opening turn prefetch cache semantics", () => {
  type PrefetchEntry = {
    role: string;
    lang: string;
    promise: Promise<{ question: string }> | null;
    data: { question: string } | null;
  };

  function canReusePrefetch(
    cache: PrefetchEntry | null,
    targetRole: string,
    targetLang: string
  ) {
    if (!cache) return false;
    return cache.role === targetRole && cache.lang === targetLang && (cache.data !== null || cache.promise !== null);
  }

  it("reuses prefetched opening question when role and language match", () => {
    const cache: PrefetchEntry = {
      role: "Software Engineer",
      lang: "en-US",
      promise: null,
      data: { question: "Tell me about your background." },
    };
    expect(canReusePrefetch(cache, "Software Engineer", "en-US")).toBe(true);
  });

  it("rejects prefetch cache when role has changed", () => {
    const cache: PrefetchEntry = {
      role: "Software Engineer",
      lang: "en-US",
      promise: null,
      data: { question: "Tell me about your background." },
    };
    expect(canReusePrefetch(cache, "Product Manager", "en-US")).toBe(false);
  });
});
