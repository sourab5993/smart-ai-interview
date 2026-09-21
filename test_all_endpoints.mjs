import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function generateWithFallback(prompt) {
  const models = ['gemini-3.6-flash', 'gemini-3.7-flash'];
  let lastError = null;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      return { text: res.text, model };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function testAll() {
  console.log('--- TEST 1: Question Generation ---');
  try {
    const q = await generateWithFallback(`Generate 2 technical interview questions for B.Tech CS Full Stack Developer. Return JSON array [{question, category, difficulty, type, expectedKeyPoints}].`);
    console.log(`✅ Success via ${q.model}! Count:`, JSON.parse(q.text).length);
  } catch (err) {
    console.log('❌ Failed:', err.message);
  }

  console.log('\n--- TEST 2: Answer Evaluation ---');
  try {
    const ev = await generateWithFallback(`Evaluate: Question: "What is React Virtual DOM?". Answer: "Virtual DOM is an in-memory representation of real DOM that uses diffing algorithm to do minimal DOM updates." Return JSON {overall_score, technical_accuracy, relevance, completeness, clarity, strengths, weaknesses, better_answer}.`);
    const parsed = JSON.parse(ev.text);
    console.log(`✅ Success via ${ev.model}! Score:`, parsed.overall_score);
  } catch (err) {
    console.log('❌ Failed:', err.message);
  }

  console.log('\n--- TEST 3: Full Interview Analysis ---');
  try {
    const report = await generateWithFallback(`Analyze mock interview: Questions answered: 1. Score: 88. Return JSON {overallScore, performanceLabel, topStrengths, topWeaknesses, aiExecutiveSummary}.`);
    const parsed = JSON.parse(report.text);
    console.log(`✅ Success via ${report.model}! Performance:`, parsed.performanceLabel);
  } catch (err) {
    console.log('❌ Failed:', err.message);
  }

  console.log('\n--- TEST 4: Resume Analysis ---');
  try {
    const resume = await generateWithFallback(`Analyze candidate resume: "Sourab - MERN Stack Developer, React, Node.js, MongoDB, Express". Target: Full Stack Developer. Return JSON {overallScore, atsCompatibilityScore, matchingSkills, missingSkills}.`);
    const parsed = JSON.parse(resume.text);
    console.log(`✅ Success via ${resume.model}! ATS Score:`, parsed.atsCompatibilityScore);
  } catch (err) {
    console.log('❌ Failed:', err.message);
  }

  console.log('\n--- TEST 5: Job Match ---');
  try {
    const jm = await generateWithFallback(`Match resume: "React, Node.js, MongoDB" with JD: "Looking for Full Stack Engineer with React, TypeScript, Node.js, AWS". Return JSON {matchScore, matchingSkills, missingSkills}.`);
    const parsed = JSON.parse(jm.text);
    console.log(`✅ Success via ${jm.model}! Match Score:`, parsed.matchScore);
  } catch (err) {
    console.log('❌ Failed:', err.message);
  }

  console.log('\n--- TEST 6: Question Explanation ---');
  try {
    const exp = await generateWithFallback(`Explain interview question: "Explain Closures in JavaScript." Return JSON {concept, approach, solutionCode, complexity, commonMistakes, interviewTip}.`);
    const parsed = JSON.parse(exp.text);
    console.log(`✅ Success via ${exp.model}! Concept:`, parsed.concept?.slice(0, 60));
  } catch (err) {
    console.log('❌ Failed:', err.message);
  }
}

testAll();
