import { useCallback, useEffect, useRef, useState } from "react";
import { safeStorage } from "@/lib/safeStorage";

export type MicDiagnostic =
  | ""
  | "permission-denied"
  | "no-device"
  | "muted-track"
  | "no-speech"
  | "hardware-error";

export type AudioInputDevice = {
  deviceId: string;
  label: string;
};

const MIC_STORAGE_KEY = "live_interview_mic_id";

export type VerifiedMicResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; diagnostic: MicDiagnostic; error: string };

/**
 * Shared microphone enumeration, device selection, and active-track verification hook
 * used by both Live Interview and Practice Interview rooms.
 */
export function useMicrophoneInput(active: boolean) {
  const [audioInputs, setAudioInputs] = useState<AudioInputDevice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(
    () => safeStorage.getItem(MIC_STORAGE_KEY) || ""
  );
  const [micDiagnostic, setMicDiagnostic] = useState<MicDiagnostic>("");
  const trackMutedRef = useRef(false);

  const selectMicDevice = useCallback((deviceId: string) => {
    setSelectedMicId(deviceId);
    safeStorage.setItem(MIC_STORAGE_KEY, deviceId);
    setMicDiagnostic("");
  }, []);

  const refreshAudioInputs = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return [] as AudioInputDevice[];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter(d => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label?.trim() || `Microphone ${idx + 1}`,
        }));
      setAudioInputs(mics);
      return mics;
    } catch {
      return [] as AudioInputDevice[];
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void refreshAudioInputs();
    const mediaDevices =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.addEventListener) return;
    const handleDeviceChange = () => {
      void refreshAudioInputs();
    };
    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [active, refreshAudioInputs]);

  const acquireVerifiedMicStream = useCallback(async (): Promise<VerifiedMicResult> => {
    setMicDiagnostic("");
    trackMutedRef.current = false;

    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setMicDiagnostic("permission-denied");
      return {
        ok: false,
        diagnostic: "permission-denied",
        error:
          "Microphone access requires a secure connection (HTTPS). Please open this site using HTTPS or switch to Text mode.",
      };
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicDiagnostic("no-device");
      return {
        ok: false,
        diagnostic: "no-device",
        error:
          "Your browser does not support microphone access. Please use Chrome, Edge, Safari, or switch to Text mode.",
      };
    }

    let micStream: MediaStream;
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {}),
      };

      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
      } catch (constraintErr: any) {
        if (
          constraintErr?.name === "NotAllowedError" ||
          constraintErr?.name === "PermissionDeniedError"
        ) {
          throw constraintErr;
        }
        console.warn(
          "Primary mic constraints rejected, retrying with simple audio:",
          constraintErr
        );
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (micErr: any) {
      const errName = micErr?.name || "";
      if (
        errName === "NotAllowedError" ||
        errName === "PermissionDeniedError"
      ) {
        setMicDiagnostic("permission-denied");
        return {
          ok: false,
          diagnostic: "permission-denied",
          error:
            "Microphone permission was denied. Allow microphone access in your browser site settings, then click Re-check mic or switch to Text mode.",
        };
      }
      if (
        errName === "NotFoundError" ||
        errName === "DevicesNotFoundError"
      ) {
        setMicDiagnostic("no-device");
        return {
          ok: false,
          diagnostic: "no-device",
          error:
            "No microphone input device was found. Connect a microphone, click Re-check mic, or switch to Text mode.",
        };
      }
      if (
        errName === "NotReadableError" ||
        errName === "TrackStartError"
      ) {
        setMicDiagnostic("hardware-error");
        return {
          ok: false,
          diagnostic: "hardware-error",
          error:
            "Your microphone could not be read (it may be in use by another app). Close other apps using the mic, switch device, or use Text mode.",
        };
      }
      setMicDiagnostic("hardware-error");
      return {
        ok: false,
        diagnostic: "hardware-error",
        error:
          micErr instanceof Error
            ? `Microphone check failed: ${micErr.message}. Your draft text is preserved.`
            : "Microphone check failed. Please re-check your microphone or switch to Text mode.",
      };
    }

    const tracks = micStream.getAudioTracks();
    if (!tracks.length) {
      setMicDiagnostic("no-device");
      return {
        ok: false,
        diagnostic: "no-device",
        error:
          "No microphone input device was found. Connect a microphone, click Re-check mic, or switch to Text mode.",
      };
    }

    const primaryTrack = tracks[0];
    primaryTrack.enabled = true;

    if (primaryTrack.readyState !== "live") {
      tracks.forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      setMicDiagnostic("no-device");
      return {
        ok: false,
        diagnostic: "no-device",
        error:
          "The selected microphone is not active. Re-check your mic or choose another input device.",
      };
    }

    trackMutedRef.current = Boolean(primaryTrack.muted);
    primaryTrack.onmute = () => {
      trackMutedRef.current = true;
    };
    primaryTrack.onunmute = () => {
      trackMutedRef.current = false;
    };

    if (primaryTrack.muted) {
      tracks.forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      setMicDiagnostic("muted-track");
      return {
        ok: false,
        diagnostic: "muted-track",
        error:
          "Your microphone track is muted by your browser or system settings. Unmute your mic (or pick another input device) and try again.",
      };
    }

    void refreshAudioInputs();
    return { ok: true, stream: micStream };
  }, [refreshAudioInputs, selectedMicId]);

  const recheckMicrophone = useCallback(async () => {
    const result = await acquireVerifiedMicStream();
    if (result.ok) {
      result.stream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      return { ok: true as const };
    }
    return {
      ok: false as const,
      diagnostic: result.diagnostic,
      error: result.error,
    };
  }, [acquireVerifiedMicStream]);

  return {
    audioInputs,
    selectedMicId,
    selectMicDevice,
    micDiagnostic,
    setMicDiagnostic,
    trackMutedRef,
    refreshAudioInputs,
    acquireVerifiedMicStream,
    recheckMicrophone,
  };
}
