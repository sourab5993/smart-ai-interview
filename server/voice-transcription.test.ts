import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_TRANSCRIPTION_AUDIO_BYTES } from "@shared/const";

vi.mock("./_core/gemini-rate-limit", () => ({
  enforceGeminiRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { transcribeAudioBuffer } from "./_core/voiceTranscription";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gemini audio transcription fallback", () => {
  it("reports missing provider configuration without making a network request", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeAudioBuffer({
        audioBuffer: Buffer.from("audio"),
        mimeType: "audio/webm",
      })
    ).resolves.toMatchObject({
      code: "SERVICE_ERROR",
      error: "Server-side transcription is not configured.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a temporary in-memory audio payload to Gemini and returns only the transcript", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "I would begin with the constraints." }],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const bytes = Buffer.from("private audio bytes");

    const result = await transcribeAudioBuffer({
      audioBuffer: bytes,
      mimeType: "audio/webm;codecs=opus",
      language: "English",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    );
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-server-key" });
    expect(url).not.toContain("test-server-key");
    expect(payload.contents[0].parts[0].text).toContain("English");
    expect(payload.contents[0].parts[1].inlineData).toEqual({
      mimeType: "audio/webm",
      data: bytes.toString("base64"),
    });
    expect(result).toMatchObject({
      task: "transcribe",
      language: "English",
      text: "I would begin with the constraints.",
      segments: [],
    });
    expect(result).not.toHaveProperty("confidence");
  });

  it("rejects unsupported or oversized media before contacting the provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeAudioBuffer({
        audioBuffer: Buffer.from("not audio"),
        mimeType: "application/octet-stream",
      })
    ).resolves.toMatchObject({ code: "INVALID_FORMAT" });
    await expect(
      transcribeAudioBuffer({
        audioBuffer: Buffer.alloc(MAX_TRANSCRIPTION_AUDIO_BYTES + 1),
        mimeType: "audio/wav",
      })
    ).resolves.toMatchObject({ code: "FILE_TOO_LARGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not return provider response details when transcription fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("sensitive provider diagnostics", { status: 400 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudioBuffer({
      audioBuffer: Buffer.from("audio"),
      mimeType: "audio/wav",
    });

    expect(result).toMatchObject({ code: "TRANSCRIPTION_FAILED" });
    expect(JSON.stringify(result)).not.toContain(
      "sensitive provider diagnostics"
    );
  });

  it("filters out known silence and static hallucinations from transcription output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Where is a hospital in this city?" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudioBuffer({
      audioBuffer: Buffer.from("silent audio bytes"),
      mimeType: "audio/webm",
      language: "en",
    });

    expect(result).toMatchObject({
      task: "transcribe",
      text: "",
    });
  });
});
