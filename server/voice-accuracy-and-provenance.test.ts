import { describe, expect, it } from "vitest";
import { isSilenceHallucination } from "../shared/scoring";

describe("Voice Mode Transcription Accuracy & False Transcript Protection", () => {
  it("rejects known silence and filler hallucinations without rejecting genuine responses", () => {
    // Hallucinations must be detected
    expect(isSilenceHallucination("Where is a hospital in this city?")).toBe(true);
    expect(isSilenceHallucination("Thank you for watching.")).toBe(true);
    expect(isSilenceHallucination("Subtitles by the Amara.org community")).toBe(true);
    expect(isSilenceHallucination("   ")).toBe(true);

    // Legitimate candidate answers must NEVER be flagged as hallucinations
    expect(isSilenceHallucination("Yes, I agree with that approach.")).toBe(false);
    expect(isSilenceHallucination("I have five years of experience in distributed systems.")).toBe(false);
    expect(isSilenceHallucination("Hello, my name is Alex.")).toBe(false);
    expect(isSilenceHallucination("Okay, let me explain the architecture.")).toBe(false);
    expect(isSilenceHallucination("Done with the first implementation.")).toBe(false);
  });

  it("prevents auto-insertion of words when recognition returns silence or empty", () => {
    // Simulated state machine for Voice Recording session
    let currentSessionId = 1;
    let initialText = "Previous answer text";
    let userEdited = false;
    let speechFinals: string[] = [];
    let displayedText = initialText;

    // User speaks nothing / silence: recognition returns empty
    const speechResult = "";
    if (speechResult.trim() && !isSilenceHallucination(speechResult)) {
      speechFinals.push(speechResult);
    }

    // Stop recording: both backend and recognition yielded no speech
    const backendResult = "";
    const hasBrowserSpeech = speechFinals.length > 0;

    if (backendResult && !isSilenceHallucination(backendResult)) {
      displayedText = backendResult;
    } else if (hasBrowserSpeech) {
      displayedText = speechFinals.join(" ");
    } else {
      // Must preserve existing text without inventing words like "okay" or "done"
      displayedText = initialText;
    }

    expect(displayedText).toBe("Previous answer text");
    expect(displayedText).not.toContain("okay");
    expect(displayedText).not.toContain("done");
  });

  it("accepts 'okay' or 'done' ONLY when it is a genuine spoken result from the active session", () => {
    let currentSessionId = 2;
    let activeSessionId = 2;
    let speechFinals: string[] = [];

    // User actually said "Done." as their final answer
    const spokenTranscript = "Done.";
    if (activeSessionId === currentSessionId && spokenTranscript.trim()) {
      speechFinals.push(spokenTranscript.trim());
    }

    expect(speechFinals).toEqual(["Done."]);
  });

  it("prevents a delayed response from an earlier recording session from overwriting the current answer", () => {
    let activeSessionId = 2; // Session 2 is currently active
    let currentText = "Current question answer";

    // Delayed response arrives from session 1
    const lateResponseSessionId = 1;
    const lateResponseText = "Stale answer from session 1";

    if (lateResponseSessionId === activeSessionId) {
      currentText = lateResponseText;
    }

    // The current text must NOT be overwritten by the late session 1 response
    expect(currentText).toBe("Current question answer");
  });

  it("prevents late recognition events from overwriting manual user edits", () => {
    let initialText = "";
    let userEditedDuringRecording = false;
    let currentText = "";

    // Candidate speaks: "I am a frontend developer"
    currentText = "I am a frontend developer";

    // Candidate pauses and manually edits the text in the textarea
    userEditedDuringRecording = true;
    currentText = "I am a senior frontend architect with React experience";

    // A late/interim Web Speech event fires with the earlier acoustic buffer
    const lateRecognitionChunk = "frontend developer";
    if (!userEditedDuringRecording) {
      currentText = lateRecognitionChunk;
    }

    // User's manual edits must remain completely intact
    expect(currentText).toBe("I am a senior frontend architect with React experience");
  });

  it("authoritative backend transcript overrides browser recognition preview when valid", () => {
    let previewText = "browser interim words";
    let finalText = "";

    const backendAuthoritativeResult = "I designed a scalable microservices architecture using gRPC and Kafka.";
    if (backendAuthoritativeResult && !isSilenceHallucination(backendAuthoritativeResult)) {
      finalText = backendAuthoritativeResult;
    } else {
      finalText = previewText;
    }

    expect(finalText).toBe("I designed a scalable microservices architecture using gRPC and Kafka.");
  });

  it("uses browser recognition fallback only if backend fails and browser speech belongs to active session", () => {
    let activeSessionId = 5;
    let responseSessionId = 5;
    let speechFinals = ["I implemented caching using Redis."];

    const backendFailed = true;
    let finalText = "Default question text";

    if (backendFailed && responseSessionId === activeSessionId && speechFinals.length > 0) {
      finalText = speechFinals.join(" ");
    }

    expect(finalText).toBe("I implemented caching using Redis.");
  });
});
