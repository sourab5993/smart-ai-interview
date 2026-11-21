import { describe, expect, it } from "vitest";
import {
  aggregateBehavioralObservations,
  combinedPracticeScore,
  type BehavioralFrame,
} from "../shared/behavioral-scoring";

function frame(overrides: Partial<BehavioralFrame> = {}): BehavioralFrame {
  return {
    timestampMs: 0,
    faceCount: 1,
    faceVisible: true,
    gaze: "camera",
    blink: false,
    yaw: 0,
    pitch: 0,
    roll: 0,
    poseVisible: true,
    torsoMovement: 0.01,
    handsVisible: 1,
    handMovement: 0.01,
    lightingOk: true,
    trackingReliable: true,
    ...overrides,
  };
}

describe("behavioral observation aggregation", () => {
  it("keeps insufficient observations unavailable instead of scoring them as zero", () => {
    const summary = aggregateBehavioralObservations([
      frame({ faceVisible: false, faceCount: 0, gaze: "unavailable", poseVisible: false, handsVisible: 0, trackingReliable: false }),
    ]);
    expect(summary.behavioralScore).toBeNull();
    expect(summary.insufficientData).toBe(true);
    expect(summary.camera.faceVisiblePercentage).toBe(0);
  });

  it("creates a factual additional-face event without a cheating label", () => {
    const summary = aggregateBehavioralObservations([
      frame({ timestampMs: 0 }),
      frame({ timestampMs: 1000, faceCount: 2 }),
      frame({ timestampMs: 2000, faceCount: 2 }),
      frame({ timestampMs: 3000, faceCount: 1 }),
    ]);
    expect(summary.camera.multipleFaceEvents).toHaveLength(1);
    expect(summary.events[0]?.type).toBe("additional_visible_face");
    expect(summary.events[0]?.detail.toLowerCase()).not.toContain("cheat");
  });

  it("does not lower camera coverage when another face is visible", () => {
    const singleFace = aggregateBehavioralObservations(
      Array.from({ length: 8 }, (_, index) => frame({ timestampMs: index * 500 }))
    );
    const additionalFace = aggregateBehavioralObservations(
      Array.from({ length: 8 }, (_, index) => frame({ timestampMs: index * 500, faceCount: index === 3 ? 2 : 1 }))
    );
    const cameraScore = (summary: typeof singleFace) => summary.categories.find(category => category.key === "camera")?.score;
    expect(cameraScore(additionalFace)).toBe(cameraScore(singleFace));
    expect(additionalFace.camera.multipleFaceEvents).toHaveLength(1);
  });

  it("keeps framing unavailable when no framing or lighting measurement exists", () => {
    const summary = aggregateBehavioralObservations([
      frame({ lightingOk: null }), frame({ timestampMs: 1000, lightingOk: null }),
    ]);
    expect(summary.camera.framingCoverage).toBeNull();
  });

  it("renormalizes available categories and keeps answer quality separate", () => {
    const summary = aggregateBehavioralObservations(
      Array.from({ length: 8 }, (_, index) => frame({ timestampMs: index * 500 })),
      { durationSeconds: 4, transcriptAvailable: true, transcriptConfidence: 0.9, speakingRateWpm: 125 }
    );
    expect(summary.behavioralScore).not.toBeNull();
    expect(summary.categories.some(category => category.key === "speech" && category.available)).toBe(true);
    expect(summary.sampleAdequacy.sufficient).toBe(true);
    expect(summary.sampleAdequacy.reliableFrames).toBe(8);
    expect(combinedPracticeScore(80, summary.behavioralScore)).toBeTypeOf("number");
  });

  it("keeps a dense but too-short sample unscored and explains the minimum", () => {
    const summary = aggregateBehavioralObservations(
      Array.from({ length: 7 }, (_, index) => frame({ timestampMs: index * 500 })),
      { durationSeconds: 3, transcriptAvailable: true, transcriptConfidence: 0.95, speakingRateWpm: 110 }
    );
    expect(summary.behavioralScore).toBeNull();
    expect(summary.insufficientData).toBe(true);
    expect(summary.sampleAdequacy.sufficient).toBe(false);
    expect(summary.sampleAdequacy.reason).toMatch(/reliable face samples spanning 3\.5 seconds/);
    expect(summary.categories.filter(category => ["gaze", "head", "movement", "camera"].includes(category.key)).every(category => !category.available && category.score === null)).toBe(true);
  });

  it("does not invent a speech-delivery score when acoustic measurements are absent", () => {
    const summary = aggregateBehavioralObservations(
      Array.from({ length: 8 }, (_, index) => frame({ timestampMs: index * 500 })),
      { durationSeconds: 4, transcriptAvailable: true, transcriptConfidence: null }
    );
    const speechCategory = summary.categories.find(category => category.key === "speech");
    expect(speechCategory?.available).toBe(false);
    expect(speechCategory?.score).toBeNull();
    expect(speechCategory?.reliability).toBe(0);
  });
});
