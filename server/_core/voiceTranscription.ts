import { enforceGeminiRateLimit } from "./gemini-rate-limit";
import { MAX_TRANSCRIPTION_AUDIO_BYTES } from "@shared/const";

export type TranscriptionSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type TranscriptionResponse = {
  task: "transcribe";
  language: string;
  duration: number | null;
  text: string;
  segments: TranscriptionSegment[];
};

export type TranscriptionError = {
  error: string;
  code:
    | "FILE_TOO_LARGE"
    | "INVALID_FORMAT"
    | "TRANSCRIPTION_FAILED"
    | "SERVICE_ERROR";
  details?: string;
};

const REQUEST_TIMEOUT_MS = 60_000;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/m4a",
  "audio/x-wav",
  "audio/wave",
]);

export async function transcribeAudioBuffer(options: {
  audioBuffer: Buffer;
  mimeType: string;
  language?: string;
  prompt?: string;
}): Promise<TranscriptionResponse | TranscriptionError> {
  if (
    !options.audioBuffer.length ||
    options.audioBuffer.length > MAX_TRANSCRIPTION_AUDIO_BYTES
  ) {
    return {
      error: "Audio file exceeds the supported size limit.",
      code: options.audioBuffer.length ? "FILE_TOO_LARGE" : "INVALID_FORMAT",
    };
  }

  const mimeType = options.mimeType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
    return {
      error: "This audio format is not supported for transcription.",
      code: "INVALID_FORMAT",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      error: "Server-side transcription is not configured.",
      code: "SERVICE_ERROR",
      details: "GEMINI_API_KEY is not configured.",
    };
  }

  const model = process.env.GEMINI_AUDIO_MODEL?.trim() || "gemini-2.5-flash";
  await enforceGeminiRateLimit("audio_transcription");
  const languagePrompt = options.language
    ? `Transcribe the speech faithfully in ${options.language} (English, Hindi, or mixed Hinglish).`
    : "Transcribe the speech faithfully in its spoken language (English, Hindi, or mixed Hinglish).";
  const geminiMimeType =
    mimeType === "audio/x-m4a" || mimeType === "audio/m4a"
      ? "audio/mp4"
      : mimeType === "audio/x-wav" || mimeType === "audio/wave"
        ? "audio/wav"
        : mimeType;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${options.prompt?.trim() || languagePrompt} Return only the transcript. Do not summarize or add commentary.`,
                },
                {
                  inlineData: {
                    mimeType: geminiMimeType,
                    data: options.audioBuffer.toString("base64"),
                  },
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      return {
        error: "The transcription provider could not process this recording.",
        code: "TRANSCRIPTION_FAILED",
      };
    }

    let result: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    try {
      result = (await response.json()) as typeof result;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          error: "The transcription provider returned an invalid response.",
          code: "TRANSCRIPTION_FAILED",
        };
      }
      throw error;
    }
    const text = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      return {
        error: "The transcription provider returned no transcript.",
        code: "TRANSCRIPTION_FAILED",
      };
    }
    return {
      task: "transcribe",
      language: options.language ?? "und",
      duration: null,
      text,
      segments: [],
    };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        error: "The transcription request timed out.",
        code: "TRANSCRIPTION_FAILED",
      };
    }
    if (error instanceof TypeError) {
      return {
        error: "The transcription provider could not be reached.",
        code: "SERVICE_ERROR",
      };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
