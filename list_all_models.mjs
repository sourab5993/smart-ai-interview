import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function list() {
  try {
    const list = await ai.models.list();
    console.log('Available models:');
    for await (const m of list) {
      if (m.name.includes('gemini') || m.name.includes('flash')) {
        console.log(m.name, m.displayName, m.supportedActions);
      }
    }
  } catch (err) {
    console.error('List models error:', err.message);
  }
}

list();
