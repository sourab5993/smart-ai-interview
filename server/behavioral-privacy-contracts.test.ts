import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  behavioralDeviceSelectionFromStream,
  behavioralDeviceSelectionStorageKey,
  behavioralMediaConstraints,
  parseBehavioralDeviceSelection,
  selectAudioTracksForTranscription,
} from "../client/src/features/behavioral-interview/device-state";

const root = process.cwd();
const behavioralPage = readFileSync(resolve(root, "client/src/features/behavioral-interview/BehavioralInterviewPages.tsx"), "utf8");
const privacyConsent = behavioralPage.slice(behavioralPage.indexOf("Optional camera and microphone privacy boundaries"), behavioralPage.indexOf("</div>\n          </div>", behavioralPage.indexOf("Optional camera and microphone privacy boundaries")));
const setupDoc = readFileSync(resolve(root, "models/behavioral/README.md"), "utf8");

describe("behavioral transcription privacy boundary", () => {
  it("selects microphone tracks only when the camera stream is also present", () => {
    const videoTrack = { kind: "video", id: "camera" };
    const microphoneTracks = [{ kind: "audio", id: "microphone" }];
    const source = {
      getAudioTracks: () => microphoneTracks,
      getVideoTracks: () => [videoTrack],
    };

    const selected = selectAudioTracksForTranscription(source);

    expect(selected).toEqual(microphoneTracks);
    expect(selected).not.toContain(videoTrack);
  });

  it("records only the active device IDs and rebuilds exact constraints in the practice room", () => {
    const selection = behavioralDeviceSelectionFromStream({
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [{ getSettings: () => ({ deviceId: "microphone-2" }) }],
    });

    expect(selection).toEqual({ cameraDeviceId: "camera-1", microphoneDeviceId: "microphone-2" });
    expect(parseBehavioralDeviceSelection(JSON.stringify(selection))).toEqual(selection);
    expect(behavioralDeviceSelectionStorageKey("session-1")).toBe("smart-interview:behavioral-device-selection:session-1");
    expect(behavioralMediaConstraints(selection)).toEqual({
      video: { deviceId: { exact: "camera-1" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { deviceId: { exact: "microphone-2" } },
    });
    expect(behavioralMediaConstraints(null)).toEqual({ video: false, audio: true });
    expect(parseBehavioralDeviceSelection("not-json")).toBeNull();
  });

  it("constructs MediaRecorder from a new audio-only stream, not the camera-bearing stream", () => {
    expect(behavioralPage).toContain("const audioTracks = selectAudioTracksForTranscription(stream)");
    expect(behavioralPage).toContain("const audioStream = new MediaStream(audioTracks)");
    expect(behavioralPage).toContain("new MediaRecorder(audioStream");
    expect(behavioralPage).not.toContain("new MediaRecorder(stream");
    expect(behavioralPage).toContain("audioBase64: await blobToBase64(blob)");
    expect(behavioralPage).toContain("behavioralDeviceSelectionStorageKey(created.id)");
    expect(behavioralPage).toContain("video: false");
    expect(behavioralPage).toContain("Camera access is optional");
    expect(behavioralPage).toContain("Enable optional camera analysis");
    expect(behavioralPage).toContain("streamRef.current?.getTracks().forEach(track => track.stop())");
    expect(behavioralPage).not.toContain("navigator.mediaDevices.getUserMedia({ video: true, audio: true })");
    expect(privacyConsent).toContain("camera video stays in your browser");
    expect(privacyConsent).toContain("Only microphone audio");
  });

  it("documents local camera handling separately from spoken-answer transcription", () => {
    expect(setupDoc).toContain("microphone audio tracks only");
    expect(setupDoc).toContain("camera video stays local");
    expect(setupDoc).toContain("provider-side retention was not verified");
  });
});
