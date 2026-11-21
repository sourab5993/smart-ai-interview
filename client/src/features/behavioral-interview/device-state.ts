export type TrackState = { readyState: string; muted: boolean };
export type BehavioralStreamState = {
  getVideoTracks(): TrackState[];
  getAudioTracks(): TrackState[];
};

export type BehavioralDeviceSelection = {
  cameraDeviceId: string;
  microphoneDeviceId: string;
};

type DeviceTrack = { getSettings(): { deviceId?: string } };
type DeviceStream = {
  getVideoTracks(): DeviceTrack[];
  getAudioTracks(): DeviceTrack[];
};

export function selectAudioTracksForTranscription<T>(source: { getAudioTracks(): T[] }): T[] {
  return [...source.getAudioTracks()];
}

export function behavioralDeviceSelectionFromStream(stream: DeviceStream): BehavioralDeviceSelection {
  return {
    cameraDeviceId: stream.getVideoTracks()[0]?.getSettings().deviceId || "",
    microphoneDeviceId: stream.getAudioTracks()[0]?.getSettings().deviceId || "",
  };
}

export function behavioralDeviceSelectionStorageKey(sessionId: string): string {
  return `smart-interview:behavioral-device-selection:${sessionId}`;
}

export function parseBehavioralDeviceSelection(value: string | null): BehavioralDeviceSelection | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BehavioralDeviceSelection>;
    if (typeof parsed.cameraDeviceId !== "string" || typeof parsed.microphoneDeviceId !== "string") return null;
    return { cameraDeviceId: parsed.cameraDeviceId, microphoneDeviceId: parsed.microphoneDeviceId };
  } catch {
    return null;
  }
}

export function behavioralMediaConstraints(selection: BehavioralDeviceSelection | null): MediaStreamConstraints {
  return {
    video: selection?.cameraDeviceId
      ? { deviceId: { exact: selection.cameraDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : false,
    audio: selection?.microphoneDeviceId
      ? { deviceId: { exact: selection.microphoneDeviceId } }
      : true,
  };
}

/** A live, unmuted microphone is sufficient; visual analysis is optional. */
export function isBehavioralAudioReady(stream: BehavioralStreamState | null | undefined): boolean {
  if (!stream) return false;
  const audio = stream.getAudioTracks();
  return audio.some(track => track.readyState === "live" && !track.muted);
}
