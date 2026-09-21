import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const candidates = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

async function checkModels() {
  for (const model of candidates) {
    process.stdout.write(`Testing ${model}... `);
    try {
      const res = await ai.models.generateContent({
        model,
        contents: 'ping',
      });
      console.log(`SUCCESS: "${res.text?.trim()}"`);
    } catch (err) {
      console.log(`FAILED: ${err.message || JSON.stringify(err)}`);
    }
  }
}

checkModels();
