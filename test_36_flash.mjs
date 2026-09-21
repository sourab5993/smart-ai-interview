import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function testWithModel(modelName) {
  console.log(`\n================ Testing Model: ${modelName} ================`);

  // 1. Question Generation
  try {
    console.log('1. Question Generation: Sending request...');
    const qPrompt = `You are a Senior Industry Bar Raiser.
Candidate: B.Tech Computer Science, Role: Software Engineer, Difficulty: Medium, Type: Technical.
Generate exactly 2 realistic interview questions.
Return ONLY a valid JSON array:
[
  {
    "question": "string",
    "category": "string",
    "difficulty": "Medium",
    "type": "Technical",
    "expectedKeyPoints": ["point 1", "point 2"]
  }
]`;
    const start = Date.now();
    const res = await ai.models.generateContent({
      model: modelName,
      contents: qPrompt,
      config: { responseMimeType: 'application/json' },
    });
    console.log(`✅ Question Generation Success (${Date.now() - start}ms):`);
    console.log(res.text);
  } catch (err) {
    console.log('❌ Question Gen Error:', err.message);
  }

  // 2. Answer Evaluation
  try {
    console.log('\n2. Answer Evaluation: Sending request...');
    const evalPrompt = `Evaluate this candidate answer.
Question: "Explain how indexing works in a relational database."
Candidate Answer: "Indexing creates a B-tree data structure on columns to provide logarithmic search time instead of linear full table scans."
Return ONLY a valid JSON object:
{
  "overall_score": 88,
  "technical_accuracy": 90,
  "relevance": 92,
  "completeness": 80,
  "clarity": 88,
  "communication": 85,
  "structure": 85,
  "confidence": 88,
  "problem_solving": 86,
  "strengths": ["Clear explanation of B-tree logarithmic time"],
  "weaknesses": ["Did not mention storage overhead"],
  "missing_points": ["Impact on write/insert operations"],
  "better_answer": "...",
  "improvement_tip": "..."
}`;
    const start = Date.now();
    const res = await ai.models.generateContent({
      model: modelName,
      contents: evalPrompt,
      config: { responseMimeType: 'application/json' },
    });
    console.log(`✅ Answer Evaluation Success (${Date.now() - start}ms):`);
    console.log(res.text);
  } catch (err) {
    console.log('❌ Answer Evaluation Error:', err.message);
  }

  // 3. Full Interview Analysis
  try {
    console.log('\n3. Full Interview Analysis: Sending request...');
    const prompt = `Assess mock interview:
Questions: [{ question: "Explain indexing", answer: "B-trees reduce scan time", score: 85 }]
Return ONLY a valid JSON object with:
{
  "overallScore": 85,
  "performanceLabel": "Strong Readiness",
  "technicalScore": 85,
  "communicationScore": 80,
  "problemSolvingScore": 85,
  "clarityScore": 85,
  "confidenceScore": 80,
  "completenessScore": 80,
  "relevanceScore": 90,
  "structureScore": 85,
  "domainSpecificScore": 85,
  "domainDimensions": [{ "dimension": "Databases", "score": 85, "comment": "Good grasp" }],
  "topStrengths": ["Good fundamentals"],
  "topWeaknesses": ["Needs more detail on write penalties"],
  "repeatedMistakes": [],
  "missingConcepts": ["Storage trade-offs"],
  "technicalKnowledgeGaps": [],
  "aiExecutiveSummary": "Solid baseline performance.",
  "personalizedImprovementPlan": ["Practice edge cases"]
}`;
    const start = Date.now();
    const res = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    console.log(`✅ Interview Analysis Success (${Date.now() - start}ms):`);
    console.log(res.text);
  } catch (err) {
    console.log('❌ Interview Analysis Error:', err.message);
  }
}

async function main() {
  await testWithModel('gemini-3.6-flash');
}

main();
