import { enforceGeminiRateLimit } from "./gemini-rate-limit";
import { MAX_TRANSCRIPTION_AUDIO_BYTES } from "@shared/const";
import { isSilenceHallucination } from "@shared/scoring";

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

  // Determine standard file extension
  const ext =
    mimeType === "audio/mp4" || mimeType === "audio/m4a" || mimeType === "audio/x-m4a"
      ? "mp4"
      : mimeType === "audio/wav" || mimeType === "audio/x-wav" || mimeType === "audio/wave"
        ? "wav"
        : mimeType === "audio/ogg"
          ? "ogg"
          : mimeType === "audio/mp3" || mimeType === "audio/mpeg"
            ? "mp3"
            : "webm";

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!geminiApiKey && !groqApiKey && !openaiApiKey) {
    return {
      error: "Server-side transcription is not configured.",
      code: "SERVICE_ERROR",
      details: "GEMINI_API_KEY is not configured.",
    };
  }

  const languagePrompt = options.language
    ? `Transcribe the speech faithfully in ${options.language} (English, Hindi, or mixed Hinglish).`
    : "Transcribe the speech faithfully in its spoken language (English, Hindi, or mixed Hinglish).";

  const geminiMimeType =
    mimeType === "audio/x-m4a" || mimeType === "audio/m4a"
      ? "audio/mp4"
      : mimeType === "audio/x-wav" || mimeType === "audio/wave"
        ? "audio/wav"
        : mimeType;

  // 1. Google Gemini Audio Transcription
  if (geminiApiKey) {
    await enforceGeminiRateLimit("audio_transcription");
    const primaryModel = process.env.GEMINI_AUDIO_MODEL?.trim() || "gemini-2.5-flash";
    const candidateModels = Array.from(
      new Set(
        [
          primaryModel,
          process.env.GEMINI_MODEL?.trim(),
          "gemini-3.5-flash-lite",
          "gemini-3.8-flash",
          "gemini-3.5-flash",
          "gemini-3-flash-preview",
        ].filter(Boolean) as string[]
      )
    );

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": geminiApiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `${options.prompt?.trim() || languagePrompt}
CRITICAL INSTRUCTION: Transcribe only genuine spoken human speech verbatim. If the audio contains only silence, background noise, breathing, static, or no clearly intelligible speech, return an empty string. Never invent or hallucinate default sentences or phrases such as "Where is a hospital in this city?" or "Thank you for watching". Return only the transcript with no commentary.`,
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
          const errorBody = await response.text();
          console.error(
            `[AudioTranscription] Provider: Google Gemini | Model: "${model}" | Stage: gemini_generate_content | Status: ${response.status} ${response.statusText} | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error: ${errorBody.slice(0, 300)}`
          );
          // Retry on model 404, 503, 429, 5xx or transient provider errors if another model is available
          const isRetryable =
            response.status === 404 ||
            response.status === 503 ||
            response.status === 429 ||
            response.status >= 500 ||
            errorBody.includes("is not available") ||
            errorBody.includes("not supported") ||
            errorBody.includes("RESOURCE_EXHAUSTED");

          if (isRetryable && i < candidateModels.length - 1) {
            continue;
          }
          break;
        }

        let result: {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        try {
          result = (await response.json()) as typeof result;
        } catch (error) {
          if (error instanceof SyntaxError) {
            console.error(
              `[AudioTranscription] Provider: Google Gemini | Model: "${model}" | Stage: gemini_json_parse | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error:`,
              error
            );
            break;
          }
          throw error;
        }

        const text = result.candidates?.[0]?.content?.parts
          ?.map(part => part.text ?? "")
          .join("")
          .trim();

        if (!text || isSilenceHallucination(text)) {
          return {
            task: "transcribe",
            language: options.language ?? "und",
            duration: null,
            text: "",
            segments: [],
          };
        }

        return {
          task: "transcribe",
          language: options.language ?? "und",
          duration: null,
          text,
          segments: [],
        };
      } catch (error: any) {
        if (controller.signal.aborted) {
          console.error(
            `[AudioTranscription] Provider: Google Gemini | Model: "${model}" | Stage: gemini_request_timeout | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error: Request timed out after ${REQUEST_TIMEOUT_MS}ms`
          );
          if (i < candidateModels.length - 1) continue;
        } else {
          console.error(
            `[AudioTranscription] Provider: Google Gemini | Model: "${model}" | Stage: gemini_fetch_exception | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error: ${error?.message || error}`
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  // 2. Fallback to Groq Whisper if configured
  if (groqApiKey) {
    try {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([new Uint8Array(options.audioBuffer)], { type: mimeType }),
        `recording.${ext}`
      );
      formData.append("model", "whisper-large-v3-turbo");
      if (options.language) {
        formData.append("language", options.language.slice(0, 2).toLowerCase());
      }

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: formData,
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        const text = (data.text || "").trim();
        if (text && !isSilenceHallucination(text)) {
          return {
            task: "transcribe",
            language: options.language ?? "und",
            duration: null,
            text,
            segments: [],
          };
        }
      } else {
        const errText = await res.text();
        console.error(
          `[AudioTranscription] Provider: Groq Whisper | Model: whisper-large-v3-turbo | Stage: groq_transcribe | Status: ${res.status} ${res.statusText} | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error: ${errText.slice(0, 300)}`
        );
      }
    } catch (groqErr: any) {
      console.error(
        `[AudioTranscription] Provider: Groq Whisper | Model: whisper-large-v3-turbo | Stage: groq_exception | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error: ${groqErr?.message || groqErr}`
      );
    }
  }

  // 3. Fallback to OpenAI Whisper if configured
  if (openaiApiKey) {
    try {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([new Uint8Array(options.audioBuffer)], { type: mimeType }),
        `recording.${ext}`
      );
      formData.append("model", "whisper-1");
      if (options.language) {
        formData.append("language", options.language.slice(0, 2).toLowerCase());
      }

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiApiKey}` },
        body: formData,
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        const text = (data.text || "").trim();
        if (text && !isSilenceHallucination(text)) {
          return {
            task: "transcribe",
            language: options.language ?? "und",
            duration: null,
            text,
            segments: [],
          };
        }
      } else {
        const errText = await res.text();
        console.error(
          `[AudioTranscription] Provider: OpenAI Whisper | Model: whisper-1 | Stage: openai_transcribe | Status: ${res.status} ${res.statusText} | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error: ${errText.slice(0, 300)}`
        );
      }
    } catch (openaiErr: any) {
      console.error(
        `[AudioTranscription] Provider: OpenAI Whisper | Model: whisper-1 | Stage: openai_exception | MIME: ${mimeType} | Ext: ${ext} | AudioSize: ${options.audioBuffer.length} bytes | Error: ${openaiErr?.message || openaiErr}`
      );
    }
  }

  return {
    error: "The transcription provider could not process this recording.",
    code: "TRANSCRIPTION_FAILED",
  };
}
