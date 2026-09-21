import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import mongoose from 'mongoose';

dotenv.config();

async function runDiagnostics() {
  console.log('=== 1. Checking Environment ===');
  console.log('PORT:', process.env.PORT);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('GEMINI_API_KEY present?:', Boolean(process.env.GEMINI_API_KEY));
  console.log('MONGODB_URI present?:', Boolean(process.env.MONGODB_URI));

  console.log('\n=== 2. Testing MongoDB Connection ===');
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_ai_interview';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB connected successfully to:', mongoose.connection.name);
    await mongoose.connection.close();
  } catch (err) {
    console.log('❌ MongoDB Connection Error:', err.message);
  }

  console.log('\n=== 3. Testing Google Gen AI SDK (gemini-3.7-flash) ===');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('❌ No GEMINI_API_KEY found in .env');
    return;
  }
  const ai = new GoogleGenAI({ apiKey });

  // Test 3.1: Question Generation
  console.log('\n--- 3.1 Question Generation Test ---');
  try {
    const qPrompt = `You are a Senior Industry Bar Raiser.
Course: B.Tech, Specialization: Computer Science, Role: Software Engineer, Difficulty: Medium, Type: Technical, Language: English.
Generate exactly 2 realistic interview questions.
Return ONLY a JSON array matching:
[
  {
    "question": "string",
    "category": "string",
    "difficulty": "Medium",
    "type": "Technical",
    "expectedKeyPoints": ["pt 1", "pt 2"]
  }
]`;
    const res = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: qPrompt,
      config: { responseMimeType: 'application/json' },
    });
    console.log('✅ Question Generation Success!');
    console.log('Generated response:', res.text?.slice(0, 300));
  } catch (err) {
    console.log('❌ Question Generation Error:', err.message);
  }

  // Test 3.2: Answer Evaluation
  console.log('\n--- 3.2 Answer Evaluation Test ---');
  try {
    const evalPrompt = `You are an AI Interview Bar Raiser evaluating a candidate's answer.
Question: "Explain how indexing works in a relational database and how B-Trees improve query performance."
Candidate's Answer: "Indexing creates a data structure like a B-tree that allows fast lookup instead of scanning the full table. It reduces disk I/O."
Return ONLY a valid JSON object:
{
  "overall_score": 85,
  "strengths": ["Clear definition"],
  "weaknesses": ["Missed write overhead"],
  "missing_points": ["Clustered vs non-clustered indexes"],
  "better_answer": "...",
  "improvement_tip": "..."
}`;
    const res = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: evalPrompt,
      config: { responseMimeType: 'application/json' },
    });
    console.log('✅ Answer Evaluation Success!');
    console.log('Evaluation response:', res.text?.slice(0, 300));
  } catch (err) {
    console.log('❌ Answer Evaluation Error:', err.message);
  }

  // Test 3.3: Full Interview Synthesis / Report
  console.log('\n--- 3.3 Full Interview Synthesis Test ---');
  try {
    const reportPrompt = `Assess this mock interview:
Questions answered: 1
Question: "Explain indexing." Score: 85.
Return JSON with overallScore, performanceLabel, topStrengths, topWeaknesses, aiExecutiveSummary.`;
    const res = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: reportPrompt,
      config: { responseMimeType: 'application/json' },
    });
    console.log('✅ Full Interview Report Synthesis Success!');
    console.log('Report response:', res.text?.slice(0, 300));
  } catch (err) {
    console.log('❌ Interview Report Synthesis Error:', err.message);
  }

  // Test 3.4: Resume Analysis
  console.log('\n--- 3.4 Resume Analysis Test ---');
  try {
    const resumePrompt = `Analyze resume: "Sourab - Software Engineer - Skills: React, Node, TypeScript, MongoDB".
Return JSON with parsedName, parsedEmail, overallScore, atsCompatibilityScore, matchingSkills, missingSkills.`;
    const res = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: resumePrompt,
      config: { responseMimeType: 'application/json' },
    });
    console.log('✅ Resume Analysis Success!');
    console.log('Resume response:', res.text?.slice(0, 300));
  } catch (err) {
    console.log('❌ Resume Analysis Error:', err.message);
  }
}

runDiagnostics();
