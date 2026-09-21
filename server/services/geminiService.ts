import { GoogleGenAI } from '@google/genai';

// Initialize Gemini Client
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
  });
}

// Resilient multi-model Gemini caller with automatic fallback and per-model timeout
export async function callGemini(
  ai: GoogleGenAI,
  prompt: string,
  config?: any
): Promise<{ text: string; modelUsed: string }> {
  // Ordered from fastest, active & highest-quota models
  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
  ];

  let lastError: any = null;
  for (const model of candidateModels) {
    try {
      // 6-second timeout per model so answers evaluate ultra-fast without hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} request timed out after 6000ms`)), 6000)
      );

      const requestPromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: config || { responseMimeType: 'application/json' },
      });

      const response: any = await Promise.race([requestPromise, timeoutPromise]);
      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[Gemini SDK] Model "${model}" failed/timed-out: ${err?.message || err}. Trying next candidate model...`);
      lastError = err;
    }
  }
  throw lastError || new Error('All candidate Gemini models failed.');
}

// High-Precision Universal Audio Transcription with Gemini AI
export async function transcribeAudioGemini(
  ai: GoogleGenAI,
  audioBase64: string,
  mimeType: string = 'audio/webm',
  language: string = 'English'
): Promise<{ text: string; source: string }> {
  const prompt = `You are an expert speech-to-text transcriber for a professional job interview.
Language context: ${language} (accurately transcribe English, Hindi, and Hinglish technical terms verbatim).
CRITICAL RULES:
1. Output ONLY the exact transcribed words spoken in the audio without quotes.
2. If words are spoken in Hindi, transcribe them in either Devanagari or standard Hinglish script as spoken.
3. If technical terms like "React", "State", "API", "Database", "Loop", "Function" are mentioned, spell them correctly.
4. Do NOT add preamble, markdown, notes, or timestamps.
5. If the audio has no speech or is only silence/noise, respond with nothing.`;

  const cleanBase64 = audioBase64.includes(';base64,')
    ? audioBase64.split(';base64,')[1]
    : audioBase64.replace(/^data:.*?base64,/, '').trim();

  // Strip codec parameters like ;codecs=opus so Gemini's inlineData receives pure mime type
  const rawMime = (mimeType || 'audio/webm').split(';')[0].trim();
  const normalizedMime = rawMime || 'audio/webm';

  // Try candidate models in priority order
  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  let transcribed = '';
  let usedModel = '';

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: normalizedMime, data: cleanBase64 } },
              { text: prompt },
            ],
          },
        ],
      });

      if (response && response.text) {
        transcribed = response.text.trim();
        usedModel = model;
        break;
      }
    } catch (modelErr: any) {
      console.warn(`Audio transcribe with ${model} failed, trying next candidate:`, modelErr?.message || modelErr);
    }
  }

  return { text: transcribed, source: usedModel || 'gemini-ai-transcribe' };
}
