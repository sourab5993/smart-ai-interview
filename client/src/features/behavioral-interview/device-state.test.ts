import { describe, expect, it } from "vitest";
import {
  behavioralMediaConstraints,
  isBehavioralAudioReady,
} from "./device-state";

const track = (readyState = "live", muted = false) => ({ readyState, muted });
const stream = (video: ReturnType<typeof track>[], audio: ReturnType<typeof track>[]) => ({
  getVideoTracks: () => video,
  getAudioTracks: () => audio,
});

describe("behavioral device readiness", () => {
  it("requires only a live, unmuted microphone; camera is optional", () => {
    expect(isBehavioralAudioReady(stream([track()], [track()]))).toBe(true);
    expect(isBehavioralAudioReady(stream([], [track()]))).toBe(true);
    expect(isBehavioralAudioReady(stream([track()], []))).toBe(false);
  });

  it("does not treat ended or muted tracks as ready", () => {
    expect(isBehavioralAudioReady(stream([track()], [track("ended")]))).toBe(false);
    expect(isBehavioralAudioReady(stream([track()], [track("live", true)]))).toBe(false);
    expect(isBehavioralAudioReady(stream([track("live", true)], [track()]))).toBe(true);
    expect(isBehavioralAudioReady(null)).toBe(false);
  });

  it("requests microphone only unless a camera device was explicitly selected", () => {
    expect(behavioralMediaConstraints(null)).toEqual({
      video: false,
      audio: true,
    });
    expect(
      behavioralMediaConstraints({
        cameraDeviceId: "camera-1",
        microphoneDeviceId: "microphone-2",
      })
    ).toEqual({
      video: {
        deviceId: { exact: "camera-1" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: { deviceId: { exact: "microphone-2" } },
    });
  });
});
