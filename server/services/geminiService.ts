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
    'gemini-3.6-flash',
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

// Universal Multimodal Document & Image OCR Extractor with Gemini AI
export async function extractDocumentTextWithGemini(
  ai: GoogleGenAI,
  base64Data: string,
  mimeType: string = 'application/pdf'
): Promise<{ text: string; modelUsed: string }> {
  const prompt = `You are a professional ATS resume text parser and high-accuracy OCR engine.
Extract ALL readable content, sections, and text from this document or resume image.
RULES:
1. Extract ALL text accurately verbatim (Candidate name, Contact info, Education, Experience, Skills, Projects, Certifications).
2. Maintain natural reading flow and section headers.
3. Transcribe dates, metrics, percentages, and bullet points exactly.
4. Output ONLY the extracted clean plain text without surrounding code blocks, markdown quotes, or chat preambles.`;

  const cleanBase64 = base64Data.includes(';base64,')
    ? base64Data.split(';base64,')[1]
    : base64Data.replace(/^data:.*?base64,/, '').trim();

  const normalizedMime = (mimeType || 'application/pdf').split(';')[0].trim().toLowerCase();
  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash'];

  let lastError: any = null;
  for (const model of candidateModels) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} OCR timed out after 10000ms`)), 10000)
      );

      const requestPromise = ai.models.generateContent({
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

      const response: any = await Promise.race([requestPromise, timeoutPromise]);
      if (response && response.text && response.text.trim().length > 10) {
        return { text: response.text.trim(), modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[Gemini OCR] Model "${model}" failed/timed-out: ${err?.message || err}. Trying next model...`);
      lastError = err;
    }
  }
  throw lastError || new Error('Multimodal document extraction failed across all Gemini candidate models.');
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
  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash'];
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
