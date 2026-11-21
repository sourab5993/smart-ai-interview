import { describe, expect, it } from "vitest";
import { getLiveAudioRetryAction } from "../client/src/features/live-interview/audio-retry";

describe("getLiveAudioRetryAction", () => {
  it("offers a new transcription attempt when only captured audio remains", () => {
    expect(
      getLiveAudioRetryAction({
        capturedAudioAvailable: true,
        transcriptDraft: "",
        persistedTranscript: null,
      })
    ).toBe("transcribe");
  });

  it("prefers saving recognized text over transcribing the same audio again", () => {
    expect(
      getLiveAudioRetryAction({
        capturedAudioAvailable: true,
        transcriptDraft: "  A candidate answer  ",
        persistedTranscript: null,
      })
    ).toBe("save-transcript");
  });

  it("does not offer duplicate audio submission after a transcript is persisted", () => {
    expect(
      getLiveAudioRetryAction({
        capturedAudioAvailable: true,
        transcriptDraft: "A candidate answer",
        persistedTranscript: "A candidate answer",
      })
    ).toBeNull();
  });

  it("offers no retry action when no audio or transcript draft exists", () => {
    expect(
      getLiveAudioRetryAction({
        capturedAudioAvailable: false,
        transcriptDraft: "  ",
        persistedTranscript: null,
      })
    ).toBeNull();
  });
});
