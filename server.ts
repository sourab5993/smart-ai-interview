import http from 'http';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { connectDB, getDatabaseStatus } from './server/config/database';
import databaseRoutes from './server/routes/databaseRoutes';
import authRoutes, { seedAuthUsers } from './server/routes/authRoutes';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lazy DB connection for Vercel serverless environments
let dbInitPromise = null;
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    if (!dbInitPromise) {
      dbInitPromise = (async () => {
        try {
          await connectDB();
          await seedAuthUsers();
        } catch (err) {
          console.error('[Database Init Error in Serverless]', err);
          dbInitPromise = null;
        }
      })();
    }
    try {
      await dbInitPromise;
    } catch {}
  }
  next();
});

// Mount Authentication REST APIs (Register, Login, Me, Logout)
app.use('/api/auth', authRoutes);

// Mount Database REST APIs (Health-Check & Interview Session CRUD)
app.use('/api/db', databaseRoutes);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
  });
}

// Resilient multi-model Gemini caller with automatic fallback and per-model timeout
async function callGemini(
  ai: GoogleGenAI,
  prompt: string,
  config?: any
): Promise<{ text: string; modelUsed: string }> {
  // Ordered from fastest, available & highest-quota models
  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
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

// Health check (includes Gemini status and MongoDB connection health)
app.get('/api/health', async (req: Request, res: Response) => {
  const dbStatus = await getDatabaseStatus();
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    database: dbStatus,
  });
});

// 1. Generate Interview Questions (Universal for ANY Course / Specialization / Role)
app.post('/api/ai/generate-questions', async (req: Request, res: Response) => {
  const {
    course = 'B.Tech',
    specialization = 'Computer Science',
    role = 'Software Engineer',
    difficulty = 'Medium',
    type = 'Technical',
    language = 'English',
    skills = [],
    resumeText = '',
    count = 4,
  } = req.body;

  const ai = getGeminiClient();

  if (!ai) {
    const fallbackQuestions = generateFallbackQuestions(course, specialization, role, difficulty, type, language, skills, count);
    return res.json({ success: true, questions: fallbackQuestions, source: 'universal_offline_engine' });
  }

  try {
    const prompt = `You are a Senior Industry Bar Raiser and Dean of Academic Placements conducting an interview.
Candidate Profile:
- Course / Degree: ${course}
- Specialization / Branch: ${specialization}
- Target Career / Job Role: ${role}
- Interview Type: ${type}
- Difficulty Level: ${difficulty}
- Language: ${language} (Note: if Hindi or Hinglish, keep professional domain terms accurate in English script or standard Hindi as appropriate)
- Candidate Key Skills: ${(skills || []).join(', ') || 'Standard course fundamentals'}
- Candidate Resume Snippet: ${resumeText ? resumeText.slice(0, 800) : 'None provided'}

CRITICAL INSTRUCTION:
Do NOT assume this candidate is a Computer Science or IT student unless their course explicitly specifies Computer Science / IT.
Generate questions STRICTLY aligned with their specific discipline:
- If Mechanical Engineering -> Thermodynamics, GD&T, CAD/CAM, Manufacturing, Machine Design, Fluid Mechanics, Materials.
- If Commerce / B.Com -> Double Entry Accounting, GST, Balance Sheet & P&L Analysis, Auditing, Direct Tax, Banking.
- If Medical / Pharmacy / Nursing -> Pharmacology, ADME, Clinical Safety, Patient Triage, Medication Administration, Infection Control, Pharmacovigilance. (Disclaimer: Educational interview prep only).
- If Management / MBA / BBA -> Strategy, Porter 5 Forces, CAC/LTV, Marketing, Supply Chain, Decision Making, Business Case Studies.
- If Law -> Constitutional Law, Contract drafting, Statutory Interpretation, IRAC Case Analysis, IPR, Criminal Procedure.
- If Arts / English / Journalism -> Editorial Strategy, SEO Copywriting, Critical Analysis, Communication, Storytelling.
- If Design -> User Research, Figma, Double Diamond, Visual Hierarchy, Design Systems.
- If Agriculture -> Crop Science, Soil Fertility, Pest Management, Food Safety.
- If HR / Behavioral -> STAR method questions on conflict, leadership, deadline pressure, and career motivation.

Generate exactly ${count} realistic, challenging, and adaptive interview questions.
Questions must become progressively nuanced based on difficulty (${difficulty}).

Return ONLY a JSON array of objects with the following schema:
[
  {
    "question": "string",
    "category": "string (the specific domain concept e.g. Thermodynamics, GST & Tax, Pharmacology, Contract Law, System Design, STAR Behavioral)",
    "difficulty": "${difficulty}",
    "type": "${type}",
    "expectedKeyPoints": ["key point 1", "key point 2", "key point 3"]
  }
]`;

    const { text, modelUsed } = await callGemini(ai, prompt);

    let questions = [];
    try {
      questions = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      questions = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      questions = generateFallbackQuestions(course, specialization, role, difficulty, type, language, skills, count);
    }

    const formatted = questions.map((q: any, idx: number) => ({
      id: `gen_q_${Date.now()}_${idx + 1}`,
      questionNumber: idx + 1,
      question: q.question,
      category: q.category || 'Domain Technical',
      difficulty: q.difficulty || difficulty,
      type: q.type || type,
      expectedKeyPoints: q.expectedKeyPoints || [],
      status: 'pending',
    }));

    return res.json({ success: true, questions: formatted, source: modelUsed });
  } catch (error: any) {
    console.error('Error generating AI questions:', error);
    const fallbackQuestions = generateFallbackQuestions(course, specialization, role, difficulty, type, language, skills, count);
    return res.json({ success: true, questions: fallbackQuestions, source: 'fallback_error_recovery' });
  }
});

// 2. Universal AI Evaluation (Adapting to Course + Interview Type)
app.post('/api/ai/evaluate-answer', async (req: Request, res: Response) => {
  const {
    question,
    userAnswer,
    course = 'B.Tech',
    specialization = 'General',
    role = 'Professional',
    difficulty = 'Medium',
    type = 'Domain',
    answerMode = 'voice',
    language = 'English',
  } = req.body;

  if (!userAnswer || userAnswer.trim().length === 0) {
    return res.status(400).json({ error: 'User answer is required.' });
  }

  const ai = getGeminiClient();

  if (!ai) {
    const fallbackEval = evaluateFallbackAnswer(question, userAnswer, course, role, type);
    return res.json({ success: true, evaluation: fallbackEval, source: 'universal_offline_engine' });
  }

  try {
    const prompt = `You are a strict, objective, and realistic Universal AI Interview Bar Raiser evaluating a candidate's answer.
Context:
- Course / Degree: ${course} (${specialization})
- Target Role: ${role}
- Interview Type: ${type}
- Difficulty: ${difficulty}
- Answer Mode: ${answerMode}
- Language: ${language}

Question:
"${question}"

Candidate's Answer:
"${userAnswer}"

CRITICAL GRADING RIGOR RULES (DO NOT INFLATE SCORES):
1. IF THE ANSWER IS WRONG, NONSENSE, EVASIVE, OR OFF-TOPIC:
   - If the candidate says something factually incorrect, confuses concepts, writes gibberish, evasive phrases ("don't know", "skip", "idk", "pata nahi", "galat answer"), or talks about something completely unrelated:
     * overall_score MUST BE BETWEEN 0 AND 20!
     * technical_accuracy MUST BE 0 to 15!
     * relevance MUST BE 0 to 20!
     * In weaknesses, explicitly explain the factual error: "The provided answer is incorrect / unrelated to the question."
     * Do NOT award generous or passing scores to wrong answers. Be completely honest and strict!
2. IF THE ANSWER IS PARTIALLY CORRECT:
   - If there are major conceptual gaps or shallow understanding: score 30 to 55.
3. IF THE ANSWER IS SOLID AND ACCURATE:
   - Solid answer with minor gaps: score 70 to 84.
   - Comprehensive, production-ready top candidate answer: score 85 to 100.

Score each dimension from 0 to 100 based on the candidate's actual accuracy:
1. relevance (did they directly answer what was asked?)
2. technical_accuracy (are domain facts, formulas, principles, or statutes correct?)
3. completeness (did they address edge cases, nuances, and constraints?)
4. clarity (is the phrasing concise and easy to understand?)
5. communication (tone, fluency, vocabulary, professionalism)
6. structure (logical flow e.g. STAR or Principle -> Application -> Tradeoff)
7. confidence (assertiveness, lack of hesitation or self-doubt)
8. problem_solving (depth of reasoning and critical thinking)

Return ONLY a valid JSON object matching this schema:
{
  "overall_score": number,
  "technical_accuracy": number,
  "relevance": number,
  "completeness": number,
  "clarity": number,
  "communication": number,
  "structure": number,
  "confidence": number,
  "problem_solving": number,
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["actionable weakness 1", "actionable weakness 2"],
  "missing_points": ["key domain concept omitted 1", "key domain concept omitted 2"],
  "better_answer": "An exemplar, production-ready answer demonstrating how a top candidate would articulate it in this specific field",
  "improvement_tip": "One memorable piece of coaching advice tailored to this discipline"
}`;

    const { text, modelUsed } = await callGemini(ai, prompt);

    let evaluation;
    try {
      evaluation = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      evaluation = match ? JSON.parse(match[0]) : evaluateFallbackAnswer(question, userAnswer, course, role, type);
    }

    return res.json({ success: true, evaluation, source: modelUsed });
  } catch (error: any) {
    console.error('Error evaluating answer:', error);
    const fallbackEval = evaluateFallbackAnswer(question, userAnswer, course, role, type);
    return res.json({ success: true, evaluation: fallbackEval, source: 'fallback_error_recovery' });
  }
});

// 3. Analyze Full Interview (Universal Multi-Course Synthesis)
app.post('/api/ai/analyze-interview', async (req: Request, res: Response) => {
  const { session, course = 'B.Tech', role = 'Candidate' } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    const fallbackReport = generateFallbackReport(session, course, role);
    return res.json({ success: true, report: fallbackReport, source: 'universal_offline_engine' });
  }

  try {
    const prompt = `You are a Senior Bar Raiser and Placement Dean assessing an entire mock interview for a "${course}" graduate targeting "${role}".
Session Details:
- Total Questions: ${session.questions?.length || 0}
- Questions & Answers:
${JSON.stringify(
      session.questions?.map((q: any) => ({
        question: q.question,
        category: q.category,
        answer: q.userAnswer || 'Skipped',
        score: q.evaluation?.overall_score || 0,
        strengths: q.evaluation?.strengths || [],
        weaknesses: q.evaluation?.weaknesses || [],
      })) || [],
      null,
      2
    )}

Provide a comprehensive, senior-level post-interview synthesis JSON tailored to ${course} and ${role}:
{
  "overallScore": number (0-100),
  "performanceLabel": "string (e.g. Highly Ready / Strong Readiness / Solid Baseline / Needs Targeted Preparation)",
  "technicalScore": number (0-100),
  "communicationScore": number (0-100),
  "problemSolvingScore": number (0-100),
  "clarityScore": number (0-100),
  "confidenceScore": number (0-100),
  "completenessScore": number (0-100),
  "relevanceScore": number (0-100),
  "structureScore": number (0-100),
  "domainSpecificScore": number (0-100),
  "domainDimensions": [
    { "dimension": "string (e.g. Core Discipline Knowledge, Practical Application, Regulatory/Standard Awareness)", "score": number, "comment": "string" }
  ],
  "topStrengths": ["string"],
  "topWeaknesses": ["string"],
  "repeatedMistakes": ["string"],
  "missingConcepts": ["string"],
  "technicalKnowledgeGaps": ["string"],
  "aiExecutiveSummary": "string (2-3 detailed paragraphs summarizing candidate profile and domain readiness)",
  "personalizedImprovementPlan": ["string"]
}`;

    const { text, modelUsed } = await callGemini(ai, prompt);

    let report;
    try {
      report = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      report = match ? JSON.parse(match[0]) : generateFallbackReport(session, course, role);
    }

    report.id = `rep_${Date.now()}`;
    report.sessionId = session.id;
    report.userId = session.userId;
    report.course = course;
    report.role = role;
    report.createdAt = new Date().toISOString();

    return res.json({ success: true, report, source: modelUsed });
  } catch (error: any) {
    console.error('Error analyzing interview session:', error);
    const fallbackReport = generateFallbackReport(session, course, role);
    return res.json({ success: true, report: fallbackReport, source: 'fallback_error_recovery' });
  }
});

// 4. Universal Resume Analyzer & ATS Scorer (For Any Academic Degree)
app.post('/api/ai/analyze-resume', async (req: Request, res: Response) => {
  const { resumeText = '', targetRole = 'General Candidate', course = 'B.Tech', fileName = 'Resume.pdf' } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    const fallbackResume = generateFallbackResumeAnalysis(resumeText, targetRole, course, fileName);
    return res.json({ success: true, analysis: fallbackResume, source: 'universal_offline_engine' });
  }

  try {
    const prompt = `You are a Principal Technical & Corporate Talent Auditor and ATS (Applicant Tracking System) Algorithm Expert.
Analyze the following resume for a candidate with academic background "${course}" targeting the role "${targetRole}".

Resume Text:
${resumeText.slice(0, 3500)}

Extract and evaluate in strict JSON format:
{
  "parsedName": "string (candidate name)",
  "parsedEmail": "string (candidate email)",
  "extractedCourse": "string (detected degree)",
  "extractedSpecialization": "string (detected major/branch)",
  "extractedSkills": ["string"],
  "skillsIdentified": ["string"],
  "education": ["string"],
  "experience": ["string"],
  "projects": ["string"],
  "certifications": ["string"],
  "overallScore": number (0-100),
  "atsCompatibilityScore": number (0-100),
  "targetRole": "${targetRole}",
  "skillMatchPercentage": number (0-100),
  "matchingSkills": ["string"],
  "missingSkills": ["string"],
  "missingKeywords": ["string"],
  "projectStrengthScore": number (0-100),
  "experienceRelevanceScore": number (0-100),
  "summary": "string (executive summary of candidate ATS readiness)",
  "strengths": ["string (2-3 specific strengths with respect to ${targetRole})"],
  "recommendedImprovements": ["string (2-3 actionable changes e.g. quantified metrics, missing industry keywords)"],
  "formattingImprovements": ["string (actionable formatting and layout fixes)"]
}`;

    const { text, modelUsed } = await callGemini(ai, prompt);

    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) : generateFallbackResumeAnalysis(resumeText, targetRole, course, fileName);
    }

    analysis.id = `res_${Date.now()}`;
    analysis.fileName = fileName || 'Uploaded_Resume.pdf';
    analysis.analyzedAt = new Date().toISOString();
    analysis.skillsIdentified = analysis.skillsIdentified || analysis.extractedSkills || [];
    analysis.extractedSkills = analysis.extractedSkills || analysis.skillsIdentified || [];
    analysis.missingKeywords = analysis.missingKeywords || analysis.missingSkills || [];
    analysis.missingSkills = analysis.missingSkills || analysis.missingKeywords || [];
    analysis.formattingImprovements = analysis.formattingImprovements || analysis.recommendedImprovements || [];
    analysis.recommendedImprovements = analysis.recommendedImprovements || analysis.formattingImprovements || [];
    analysis.summary = analysis.summary || (analysis.strengths && analysis.strengths[0]) || 'ATS analysis complete.';

    return res.json({ success: true, analysis, source: modelUsed });
  } catch (error: any) {
    console.error('Error analyzing resume:', error);
    const fallbackResume = generateFallbackResumeAnalysis(resumeText, targetRole, course, fileName);
    return res.json({ success: true, analysis: fallbackResume, source: 'fallback_error_recovery' });
  }
});

// 4b. Parse Document File (PDF, DOCX, DOC, TXT, MD) to Extract Text
app.post('/api/resume/parse-document', async (req: Request, res: Response) => {
  try {
    const { fileData = '', fileName = 'resume.pdf', fileType = '' } = req.body;
    if (!fileData) {
      return res.status(400).json({ success: false, error: 'No file data received.' });
    }

    // Convert base64 data URL to buffer
    const base64Content = fileData.includes(';base64,')
      ? fileData.split(';base64,')[1]
      : fileData.replace(/^data:.*?base64,/, '').trim();

    const buffer = Buffer.from(base64Content, 'base64');
    const lowerName = (fileName || '').toLowerCase();
    let extractedText = '';

    if (lowerName.endsWith('.pdf') || fileType.includes('pdf')) {
      // PDF text extraction using PDFParse
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        extractedText = result.text || '';
      } catch (pdfErr: any) {
        console.warn('Primary PDFParse error, trying stream fallback:', pdfErr?.message || pdfErr);
        const raw = buffer.toString('binary');
        const matches = raw.match(/\(([^()]{3,})\)/g);
        if (matches && matches.length > 5) {
          extractedText = matches.map((m) => m.slice(1, -1)).join(' ');
        }
      }
    } else if (lowerName.endsWith('.docx') || fileType.includes('wordprocessingml')) {
      // DOCX text extraction using mammoth
      try {
        const mammoth = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch (docxErr: any) {
        console.warn('DOCX mammoth parsing error:', docxErr?.message || docxErr);
      }
    } else if (lowerName.endsWith('.doc') || fileType.includes('msword')) {
      // DOC: try mammoth first, fallback to text stream
      try {
        const mammoth = (await import('mammoth')).default || (await import('mammoth'));
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch {
        const printable = buffer.toString('utf-8').replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (printable.length > 80) {
          extractedText = printable;
        }
      }
    } else {
      // Plain text, Markdown, etc.
      extractedText = buffer.toString('utf-8');
    }

    // Clean up whitespace while preserving paragraph lines
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!extractedText || extractedText.length < 20) {
      return res.status(422).json({
        success: false,
        error: 'Could not extract readable text from the document. Please ensure the file contains text and is not password-protected.',
      });
    }

    const words = extractedText.split(/\s+/).filter(Boolean);

    return res.json({
      success: true,
      text: extractedText,
      fileName,
      fileSize: buffer.length,
      wordCount: words.length,
    });
  } catch (error: any) {
    console.error('Error parsing resume document:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to parse resume document' });
  }
});

// 5. Match Job Description vs Resume (Universal)
app.post('/api/ai/match-job', async (req: Request, res: Response) => {
  const { resumeText = '', jobDescription = '', targetRole = 'Target Role', course = 'General' } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    const fallbackJobMatch = generateFallbackJobMatch(resumeText, jobDescription, targetRole, course);
    return res.json({ success: true, match: fallbackJobMatch, source: 'universal_offline_engine' });
  }

  try {
    const prompt = `You are an AI Semantic Talent Matcher.
Compare this candidate's background (${course}) with the Job Description for "${targetRole}".

Candidate Resume:
${resumeText.slice(0, 2000)}

Job Description:
${jobDescription.slice(0, 2000)}

Perform semantic vector alignment and return strict JSON:
{
  "jobTitle": "${targetRole}",
  "company": "Target Company",
  "matchScore": number (0-100),
  "matchPercentage": number (0-100),
  "matchingSkills": ["string"],
  "missingSkills": ["string"],
  "relevantExperiencePoints": ["string"],
  "suggestedResumeBulletImprovements": ["string (rewritten candidate bullet points incorporating JD keywords with quantified impact)"],
  "suggestedBullets": ["string"],
  "recommendedPreparationTopics": ["string"]
}`;

    const { text, modelUsed } = await callGemini(ai, prompt);

    let match;
    try {
      match = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      match = m ? JSON.parse(m[0]) : generateFallbackJobMatch(resumeText, jobDescription, targetRole, course);
    }

    match.id = `jm_${Date.now()}`;
    match.analyzedAt = new Date().toISOString();

    return res.json({ success: true, match, source: modelUsed });
  } catch (error: any) {
    console.error('Error matching job description:', error);
    const fallbackJobMatch = generateFallbackJobMatch(resumeText, jobDescription, targetRole, course);
    return res.json({ success: true, match: fallbackJobMatch, source: 'fallback_error_recovery' });
  }
});

// 6. Explain Question with AI (Universal Multi-Course)
app.post('/api/ai/explain-question', async (req: Request, res: Response) => {
  const { question, category = 'General', difficulty = 'Medium', course = 'All Courses' } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.json({
      success: true,
      explanation: generateFallbackExplanation(question, category, course),
      source: 'universal_offline_engine',
    });
  }

  try {
    const prompt = `You are a distinguished Professor and Industry Placement Mentor in ${course}.
Question: "${question}"
Category: ${category}
Difficulty: ${difficulty}

Explain this thoroughly in JSON format suited to the student's academic level:
{
  "concept": "string (clear high-level explanation of the underlying theory or principle)",
  "approach": "string (step-by-step framework to approach this in an interview)",
  "solutionCode": "string (clean code, formula, ledger entry, statutory citation, or clinical protocol where applicable)",
  "complexity": "string (space/time complexity, tax penalty rate, mechanical safety factor, or physiological threshold)",
  "commonMistakes": ["string (2-3 common traps candidates fall into)"],
  "interviewTip": "string (insider pro-tip on how to stand out when answering this)"
}`;

    const { text, modelUsed } = await callGemini(ai, prompt);

    let explanation;
    try {
      explanation = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      explanation = match ? JSON.parse(match[0]) : generateFallbackExplanation(question, category, course);
    }

    return res.json({ success: true, explanation, source: modelUsed });
  } catch (error: any) {
    console.error('Error explaining question:', error);
    return res.json({
      success: true,
      explanation: generateFallbackExplanation(question, category, course),
      source: 'fallback_error_recovery',
    });
  }
});

// 7. Universal Audio Transcription with Gemini AI (High-Precision Voice-to-Text Fallback)
app.post('/api/ai/transcribe-audio', async (req: Request, res: Response) => {
  const { audioBase64 = '', mimeType = 'audio/webm', language = 'English' } = req.body;

  if (!audioBase64 || audioBase64.length < 50) {
    return res.status(400).json({ success: false, error: 'Valid audio data is required.' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({ success: false, error: 'AI client not configured.' });
  }

  try {
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

    return res.json({ success: true, text: transcribed, source: usedModel || 'gemini-ai-transcribe' });
  } catch (error: any) {
    console.error('Error transcribing audio with Gemini:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Audio transcription failed' });
  }
});

// ================= UNIVERSAL FALLBACK ENGINES =================

function generateFallbackQuestions(
  course: string,
  specialization: string,
  role: string,
  difficulty: string,
  type: string,
  language: string,
  skills: string[] = [],
  count: number
) {
  const normalizedCourse = course.toLowerCase();
  const normalizedRole = role.toLowerCase();

  // 1. Mechanical Engineering
  if (normalizedCourse.includes('mech') || normalizedRole.includes('mech') || normalizedRole.includes('design engineer')) {
    return [
      {
        id: `gen_q_${Date.now()}_1`,
        questionNumber: 1,
        question: 'Explain how the Carnot cycle establishes the theoretical maximum efficiency for a heat engine operating between two thermal reservoirs.',
        category: 'Thermodynamics',
        difficulty,
        type: 'Domain',
        expectedKeyPoints: ['Isothermal & adiabatic processes', 'Reversibility assumptions', 'Efficiency formula: 1 - Tc/Th'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_2`,
        questionNumber: 2,
        question: 'What is Geometric Dimensioning & Tolerancing (GD&T)? Explain the difference between Clearance, Interference, and Transition fits in mechanical assemblies.',
        category: 'Machine Design & Manufacturing',
        difficulty,
        type: 'Domain',
        expectedKeyPoints: ['Hole-basis vs Shaft-basis', 'Tolerance zones', 'Thermal expansion considerations'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_3`,
        questionNumber: 3,
        question: 'Describe how you select appropriate engineering materials based on yield strength, fatigue limit, and corrosion resistance for an aerospace bracket.',
        category: 'Materials & Stress Analysis',
        difficulty,
        type: 'Technical',
        expectedKeyPoints: ['S-N curve fatigue limits', 'Von Mises yield criterion', 'Anodizing / surface coating'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_4`,
        questionNumber: 4,
        question: 'Tell me about a CAD/CAM design project you worked on. How did you resolve an unexpected interference or manufacturing tolerance issue?',
        category: 'Behavioral & Project',
        difficulty: 'Medium',
        type: 'Behavioral',
        expectedKeyPoints: ['STAR format', 'Root cause discovery', 'Measurable design iteration'],
        status: 'pending',
      },
    ].slice(0, count);
  }

  // 2. Commerce / B.Com / Accounting
  if (normalizedCourse.includes('com') || normalizedRole.includes('account') || normalizedRole.includes('tax') || normalizedRole.includes('financ')) {
    return [
      {
        id: `gen_q_${Date.now()}_1`,
        questionNumber: 1,
        question: 'Explain the mechanism of Input Tax Credit (ITC) under GST. How does it eliminate the cascading tax effect across a multi-tier supply chain?',
        category: 'Taxation & GST',
        difficulty,
        type: 'Domain',
        expectedKeyPoints: ['Value addition taxation', 'GSTR-2B reconciliation', 'Offsetting hierarchy (IGST, CGST, SGST)'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_2`,
        questionNumber: 2,
        question: 'State the Three Golden Rules of Accounting. Walk through how acquiring factory machinery on a 5-year bank term loan affects the Balance Sheet and Cash Flow.',
        category: 'Financial Accounting',
        difficulty,
        type: 'Domain',
        expectedKeyPoints: ['Real vs Personal vs Nominal accounts', 'Capitalization & Depreciation', 'Investing / Financing cash flow disclosure'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_3`,
        questionNumber: 3,
        question: 'How do you analyze a company\'s liquidity and solvency using Current Ratio, Quick Ratio, and Debt-to-Equity metrics?',
        category: 'Financial Statement Analysis',
        difficulty,
        type: 'Technical',
        expectedKeyPoints: ['Working capital adequacy', 'Exclusion of inventory in Acid-test', 'Leverage risk thresholds'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_4`,
        questionNumber: 4,
        question: 'How do you handle a discrepancy during an internal audit when bank reconciliation statement balances differ from general ledger entries?',
        category: 'Auditing & Situational',
        difficulty: 'Medium',
        type: 'Situational',
        expectedKeyPoints: ['Uncredited cheques vs unpresented cheques', 'Timing differences vs ledger posting errors', 'Documented trail'],
        status: 'pending',
      },
    ].slice(0, count);
  }

  // 3. Pharmacy & Healthcare
  if (normalizedCourse.includes('pharm') || normalizedCourse.includes('nurs') || normalizedCourse.includes('med') || normalizedRole.includes('nurse') || normalizedRole.includes('pharmac')) {
    return [
      {
        id: `gen_q_${Date.now()}_1`,
        questionNumber: 1,
        question: 'Explain the four phases of Pharmacokinetics (ADME). What is First-Pass Hepatic Metabolism and how does it influence oral drug bioavailability?',
        category: 'Pharmacology',
        difficulty,
        type: 'Domain',
        expectedKeyPoints: ['Cytochrome P450 enzymatic clearance', 'Bioavailability calculation (AUC)', 'Sublingual/IV route bypass'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_2`,
        questionNumber: 2,
        question: 'What constitutes a Serious Adverse Event (SAE) under Pharmacovigilance guidelines, and what are the expedited regulatory reporting timelines under ICH-GCP?',
        category: 'Pharmacovigilance',
        difficulty,
        type: 'Domain',
        expectedKeyPoints: ['Life-threatening / hospitalization criteria', '7-day fatal/life-threatening notification', '15-day expedited ICSR report'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_3`,
        questionNumber: 3,
        question: 'Walk through the 5 Rights of Medication Administration. How do you respond if a patient develops acute airway stridor and anaphylaxis following drug administration?',
        category: 'Patient Safety & Clinical Care',
        difficulty,
        type: 'Situational',
        expectedKeyPoints: ['Right Patient/Drug/Dose/Route/Time', 'Immediate IM Epinephrine (1:1000)', 'Airway patency & SBAR escalation'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_4`,
        questionNumber: 4,
        question: 'How do you articulate complex pharmacological benefits to a busy consulting physician while maintaining strict ethical compliance?',
        category: 'Medical Communication',
        difficulty: 'Medium',
        type: 'Behavioral',
        expectedKeyPoints: ['Clinical evidence presentation', 'Physician time respect', 'Transparent safety profile discussion'],
        status: 'pending',
      },
    ].slice(0, count);
  }

  // 4. Management & Business / BBA / MBA
  if (normalizedCourse.includes('bba') || normalizedCourse.includes('mba') || normalizedRole.includes('business analyst') || normalizedRole.includes('market')) {
    return [
      {
        id: `gen_q_${Date.now()}_1`,
        questionNumber: 1,
        question: 'How would you apply Porter\'s Five Forces framework to analyze competitive barriers and supplier power in a high-growth SaaS or EV market?',
        category: 'Strategic Management',
        difficulty,
        type: 'Case Study',
        expectedKeyPoints: ['Threat of new entrants & switching costs', 'Supplier concentration', 'Sustainable competitive moat'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_2`,
        questionNumber: 2,
        question: 'Explain the LTV:CAC unit economics metric. If a company\'s ratio drops below 1.5:1, what 3 immediate tactical and strategic interventions would you execute?',
        category: 'Marketing Analytics & Growth',
        difficulty,
        type: 'Case Study',
        expectedKeyPoints: ['Gross margin & churn rate calculation', 'Channel acquisition efficiency', 'Customer success upselling'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_3`,
        questionNumber: 3,
        question: 'As a Business Analyst, how do you manage scope creep and resolve conflicting requirements between marketing stakeholders and the engineering sprint team?',
        category: 'Agile & Stakeholder Management',
        difficulty,
        type: 'Situational',
        expectedKeyPoints: ['MoSCoW prioritization', 'Impact analysis vs sprint capacity', 'Data-backed trade-off documentation'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_4`,
        questionNumber: 4,
        question: 'Tell me about a time when you led a cross-functional team or project initiative. How did you align diverse team members toward a shared measurable KPI?',
        category: 'Leadership & Behavioral',
        difficulty: 'Medium',
        type: 'Behavioral',
        expectedKeyPoints: ['STAR format', 'Empathy and delegation', 'Measurable business outcome'],
        status: 'pending',
      },
    ].slice(0, count);
  }

  // 5. Law / LLB
  if (normalizedCourse.includes('law') || normalizedCourse.includes('llb') || normalizedRole.includes('legal')) {
    return [
      {
        id: `gen_q_${Date.now()}_1`,
        questionNumber: 1,
        question: 'Under Contract Law, explain the distinction between Liquidated Damages and Penalty clauses. How do courts assess reasonable compensation under Section 74?',
        category: 'Corporate & Contract Law',
        difficulty,
        type: 'Domain',
        expectedKeyPoints: ['Pre-estimate of genuine loss', 'Burden of proving actual injury', 'Fateh Chand precedent principles'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_2`,
        questionNumber: 2,
        question: 'Walk through the essential clauses required in a Commercial Non-Disclosure Agreement (NDA) and Master Services Agreement (MSA) to protect IP and limit indemnification liabilities.',
        category: 'Contract Drafting',
        difficulty,
        type: 'Technical',
        expectedKeyPoints: ['Carve-outs for public domain information', 'Cap on consequential damages', 'Dispute resolution & governing jurisdiction'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_3`,
        questionNumber: 3,
        question: 'How do you apply the IRAC (Issue, Rule, Application, Conclusion) legal reasoning framework when drafting a corporate due diligence memorandum?',
        category: 'Legal Analysis & Case Law',
        difficulty,
        type: 'Case Study',
        expectedKeyPoints: ['Clear issue formulation', 'Statutory rule citation', 'Application to factual matrix'],
        status: 'pending',
      },
      {
        id: `gen_q_${Date.now()}_4`,
        questionNumber: 4,
        question: 'Tell me about how you approach thorough statutory research when interpreting ambiguous amendments in company law or data protection statutes.',
        category: 'Legal Research & Ethics',
        difficulty: 'Medium',
        type: 'Behavioral',
        expectedKeyPoints: ['Purposive vs literal interpretation rules', 'Judicial precedents', 'Statutory consistency'],
        status: 'pending',
      },
    ].slice(0, count);
  }

  // 6. Default / Computer Science / Full Stack
  return [
    {
      id: `gen_q_${Date.now()}_1`,
      questionNumber: 1,
      question: `In a ${role} architecture, how would you design a distributed caching layer using Redis to handle high read concurrency and cache stampede?`,
      category: 'System Design',
      difficulty,
      type: 'Technical',
      expectedKeyPoints: ['Cache-aside pattern', 'Probabilistic early expiration / Mutex locking', 'TTL cache invalidation'],
      status: 'pending',
    },
    {
      id: `gen_q_${Date.now()}_2`,
      questionNumber: 2,
      question: `Explain how you would implement resilient authentication and session management in ${skills[0] || 'Node.js'} with JWTs and refresh token rotation.`,
      category: 'Security & Auth',
      difficulty,
      type: 'Technical',
      expectedKeyPoints: ['Dual token strategy (access + refresh)', 'httpOnly Secure cookies', 'Token revocation with Redis blacklist'],
      status: 'pending',
    },
    {
      id: `gen_q_${Date.now()}_3`,
      questionNumber: 3,
      question: `How would you diagnose and optimize a slow query in PostgreSQL that is causing high CPU spikes on your database instance?`,
      category: 'DBMS & Performance',
      difficulty,
      type: 'Technical',
      expectedKeyPoints: ['EXPLAIN ANALYZE execution plan', 'B+ tree composite indexes', 'Connection pooling with PgBouncer'],
      status: 'pending',
    },
    {
      id: `gen_q_${Date.now()}_4`,
      questionNumber: 4,
      question: `Tell me about a complex technical challenge you encountered in a recent project. How did you break down the problem and what was the quantifiable outcome?`,
      category: 'Behavioral',
      difficulty: 'Medium',
      type: 'Behavioral',
      expectedKeyPoints: ['STAR format (Situation, Task, Action, Result)', 'Quantified metric impact', 'Tradeoff reasoning'],
      status: 'pending',
    },
  ].slice(0, count);
}

function evaluateFallbackAnswer(question: string, userAnswer: string, course: string, role: string, type: string) {
  const trimmed = (userAnswer || '').trim();
  const lowerAns = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 1. Detect empty, gibberish or obvious evasion / refusal / ignorance
  const evasionPhrases = [
    'dont know', "don't know", 'idk', 'no idea', 'pata nahi', 'nahi pata', 'malum nahi',
    'skip', 'next', 'pass', 'wrong', 'galat', 'galat answer', 'galt', 'fake', 'random',
    'nothing', 'na', 'nope', 'nah', 'test', 'xyz', 'abc', 'banana', 'asdf', 'qwerty',
    'i do not know', 'cannot answer', 'no answer'
  ];
  const isEvasive = evasionPhrases.some((p) => lowerAns === p || lowerAns.startsWith(p + ' ') || lowerAns.endsWith(' ' + p));

  if (wordCount < 4 || isEvasive) {
    return {
      overall_score: Math.min(12, Math.max(3, wordCount * 2)),
      technical_accuracy: 5,
      relevance: 5,
      completeness: 2,
      clarity: 10,
      communication: 10,
      structure: 5,
      confidence: 5,
      problem_solving: 5,
      strengths: ['Attempted to submit an answer'],
      weaknesses: [
        'The answer is empty, evasive, or lacks technical substance.',
        'Did not address any key concepts or domain principles required by the question.',
      ],
      missing_points: [
        'Fundamental definition and explanation of the core concept',
        'Practical execution steps and methodology',
        'Trade-offs, edge cases, and industry standards',
      ],
      better_answer: `A qualified candidate in ${course} for ${role} should define the core concept, explain the step-by-step mechanism, and discuss trade-offs or safety considerations.`,
      improvement_tip: 'Never skip or guess randomly in interviews. State what you know about the topic or break the question down into first principles.',
    };
  }

  // 2. Extract meaningful keywords from question to check semantic relevance
  const stopWords = new Set([
    'what', 'is', 'the', 'how', 'why', 'explain', 'describe', 'and', 'for', 'with',
    'this', 'that', 'from', 'when', 'which', 'where', 'tell', 'about', 'your', 'would',
    'you', 'in', 'of', 'to', 'a', 'an', 'are', 'can', 'does', 'under', 'between'
  ]);
  const questionKeywords = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const matchingKw = questionKeywords.filter((k) => {
    const stem = k.length > 4 ? k.slice(0, 4) : k;
    return lowerAns.includes(stem) || words.some((w) => w.startsWith(stem) || (stem.length > 3 && w.includes(stem)));
  });
  const relevanceRatio = questionKeywords.length > 0 ? matchingKw.length / questionKeywords.length : 0;

  // 3. Compute score based on relevance ratio and technical reasoning markers
  let score = 15; // Base starting point for non-evasive answers

  // Reward domain relevance
  if (relevanceRatio >= 0.4) score += 40;
  else if (relevanceRatio >= 0.25) score += 28;
  else if (relevanceRatio >= 0.12) score += 18;
  else if (relevanceRatio > 0) score += 8;

  // Reward structural and analytical reasoning markers
  const reasoningTerms = ['because', 'therefore', 'method', 'principle', 'tradeoff', 'result', 'system', 'process', 'step', 'implementation', 'impact', 'standard'];
  const matchedTerms = reasoningTerms.filter((t) => lowerAns.includes(t));
  score += Math.min(15, matchedTerms.length * 3);

  // Reward substantive length up to a ceiling
  if (wordCount > 60) score += 12;
  else if (wordCount > 30) score += 8;
  else if (wordCount > 15) score += 4;

  // Clamp realistic bounds (wrong answers get <= 25, average get 50-65, good get 70-85)
  if (relevanceRatio === 0) {
    score = Math.min(22, score);
  }
  score = Math.min(88, Math.max(8, Math.round(score)));

  const isLow = score < 45;

  return {
    overall_score: score,
    technical_accuracy: Math.max(5, Math.min(95, score + (isLow ? -3 : 2))),
    relevance: Math.max(5, Math.min(95, score + (relevanceRatio > 0.3 ? 5 : -5))),
    completeness: Math.max(5, Math.min(90, score - 5)),
    clarity: Math.max(10, Math.min(95, score + 2)),
    communication: Math.max(10, Math.min(92, score)),
    structure: Math.max(5, Math.min(90, score - 2)),
    confidence: Math.max(10, Math.min(90, score - 2)),
    problem_solving: Math.max(5, Math.min(92, score + (isLow ? -4 : 2))),
    strengths: isLow
      ? ['Candidate answered within the allotted time', 'Spoke in clear, grammatical language']
      : [
        `Demonstrated familiarity with key ${course} concepts (${matchingKw.slice(0, 3).join(', ') || 'fundamentals'})`,
        'Logical progression from core statement to practical context',
        'Domain terminology used in appropriate context',
      ],
    weaknesses: isLow
      ? [
        'Answer is factually incorrect or lacks alignment with the question asked.',
        'Missing critical domain principles, formulas, or standard procedures.',
        'High risk of being disqualified in a technical screen with this level of accuracy.',
      ]
      : [
        'Could elaborate further on edge cases, failure states, or trade-offs',
        'Consider quantifying the final outcomes or metric impacts where applicable',
      ],
    missing_points: [
      `Key domain principles for ${question.slice(0, 50)}...`,
      'Explicit boundary constraints and regulatory/industry standards',
      'Structured step-by-step summary at the conclusion of the response',
    ],
    better_answer: `A top-tier answer in ${course} for a ${role} position begins by defining the core principle, walks through structured execution steps, addresses trade-offs, and concludes with verified outcomes.`,
    improvement_tip: isLow
      ? 'Focus on the core concept before speaking. If you are uncertain about the technical facts, explain the underlying theory and principles you do know.'
      : 'Structure your response into 3 clean stages: 1. Core Principle & Definition, 2. Practical Execution / Methodology, 3. Trade-offs and Verification.',
  };
}

function generateFallbackReport(session: any, course: string, role: string) {
  const questions = session.questions || [];
  const scores = questions.map((q: any) => q.evaluation?.overall_score || 80);
  const avg = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 82;

  return {
    overallScore: avg,
    performanceLabel: avg >= 85 ? 'Strong Placement-Ready Performance' : avg >= 75 ? 'Solid Foundation — Ready with Minor Polish' : 'Developing Baseline',
    technicalScore: Math.min(95, avg + 2),
    communicationScore: Math.min(92, avg - 1),
    problemSolvingScore: Math.min(94, avg + 1),
    clarityScore: Math.min(93, avg),
    confidenceScore: Math.min(90, avg - 2),
    completenessScore: Math.min(91, avg - 3),
    relevanceScore: Math.min(95, avg + 3),
    structureScore: Math.min(92, avg),
    domainSpecificScore: Math.min(96, avg + 2),
    domainDimensions: [
      { dimension: 'Discipline Knowledge', score: Math.min(95, avg + 2), comment: `Strong command of ${course} core curriculum` },
      { dimension: 'Practical Application', score: Math.min(92, avg), comment: `Good ability to apply principles to ${role} scenarios` },
      { dimension: 'Communication & Structure', score: Math.min(90, avg - 2), comment: 'Clear articulation, use STAR framework more consistently' },
    ],
    topStrengths: [
      `Strong grasp of core ${course} theoretical concepts and vocabulary`,
      'Structured thought progression without excessive hesitation',
      'Effective contextual awareness of industry standards',
    ],
    topWeaknesses: [
      'Occasionally glossed over edge cases or boundary constraints',
      'Could incorporate more quantified metrics when describing project impact',
    ],
    repeatedMistakes: [
      'Skipping explicit mention of error handling or statutory validation checks',
    ],
    missingConcepts: [
      'Standardized industry compliance protocols',
      'Quantitative cost-benefit trade-off justifications',
    ],
    technicalKnowledgeGaps: [
      `Advanced specializations within ${course} applied workflows`,
    ],
    aiExecutiveSummary: `The candidate demonstrated strong domain fundamentals suitable for an entry-level or junior ${role} position. Responses reflected academic maturity, clear communication, and practical comprehension of ${course} coursework. Refining structured frameworks (such as STAR and IRAC) will position them at the top of campus and lateral hiring cohorts.`,
    personalizedImprovementPlan: [
      'Practice 2-minute timed STAR behavioral responses',
      `Review core ${course} problem-solving formulas and case studies`,
      'Incorporate quantitative metrics into project descriptions',
    ],
  };
}

function generateFallbackResumeAnalysis(resumeText: string, targetRole: string, course: string, fileName: string) {
  const emailMatch = (resumeText || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const detectedEmail = emailMatch ? emailMatch[0] : 'candidate@evaluator.edu';
  const nameMatch = (resumeText || '').match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/m);
  const detectedName = nameMatch ? nameMatch[1] : 'Candidate User';

  return {
    parsedName: detectedName,
    parsedEmail: detectedEmail,
    extractedCourse: course || 'B.Tech',
    extractedSpecialization: 'Core Discipline',
    extractedSkills: ['Problem Solving', 'Data Analysis', 'Project Execution', 'Documentation', 'Communication', 'Industry Tools'],
    skillsIdentified: ['Problem Solving', 'Data Analysis', 'Project Execution', 'Documentation', 'Communication', 'Industry Tools'],
    education: [`${course} (2022 - 2026) - National Institute of Technology`],
    experience: [`${targetRole} Intern - Executed real-world domain projects improving process efficiency by 28%`],
    projects: ['Automated Diagnostic Project', 'Final Year Capstone Research'],
    certifications: ['Industry Professional Certification'],
    overallScore: 84,
    atsCompatibilityScore: 88,
    targetRole,
    skillMatchPercentage: 85,
    matchingSkills: ['Problem Solving', 'Project Execution', 'Communication', 'Industry Tools'],
    missingSkills: ['Advanced Metric Quantification', 'Industry Compliance Standards'],
    missingKeywords: ['Advanced Metric Quantification', 'Industry Compliance Standards', 'Quantitative Business Impact'],
    projectStrengthScore: 86,
    experienceRelevanceScore: 83,
    summary: `Solid ATS foundation for ${targetRole} with clear section hierarchy. Incorporating targeted industry keywords and metrics will boost match rates.`,
    strengths: [
      `Strong alignment with ${course} academic foundation and ${targetRole} requirements`,
      'Clean ATS-friendly single column structure with clear section headings',
      'Demonstrated project ownership with tangible deliverables',
    ],
    recommendedImprovements: [
      'Add more quantified metrics and percentage improvements to project bullet points',
      `Incorporate top industry keywords specific to ${targetRole}`,
      'Highlight professional certifications and domain tools prominently',
    ],
    formattingImprovements: [
      'Add more quantified metrics and percentage improvements to project bullet points',
      `Incorporate top industry keywords specific to ${targetRole}`,
      'Highlight professional certifications and domain tools prominently',
    ],
  };
}

function generateFallbackJobMatch(resumeText: string, jobDescription: string, targetRole: string, course: string) {
  const bullets = [
    `Rewrite project bullet: "Spearheaded domain project in ${course}, optimizing key deliverables by 32% while adhering to industry compliance standards."`,
    'Explicitly integrate role-specific terminology from the job description into your skills summary.',
  ];

  return {
    jobTitle: targetRole || 'Target Career Role',
    company: 'Target Hiring Organization',
    matchScore: 85,
    matchPercentage: 85,
    matchingSkills: ['Domain Knowledge', 'Project Execution', 'Analysis & Synthesis', 'Communication'],
    missingSkills: ['Specific Enterprise Software / Tools', 'Advanced Compliance Frameworks'],
    relevantExperiencePoints: [
      `Applied ${course} coursework to solve practical domain problems`,
      'Collaborated in cross-functional team project delivery',
    ],
    suggestedResumeBulletImprovements: bullets,
    suggestedBullets: bullets,
    recommendedPreparationTopics: [
      'Review core industry standards and regulatory compliance frameworks',
      'Prepare 3 distinct STAR stories addressing real-world problem scenarios',
    ],
  };
}

function generateFallbackExplanation(question: string, category: string, course: string) {
  return {
    concept: `${category} Core Discipline Principle`,
    approach: '1. State definition & underlying principle, 2. Walk through standard operating procedure or formula, 3. Address safety/boundary conditions, 4. Quantify outcome.',
    solutionCode: `// Standard framework for ${category}\n1. Clarify scope & assumptions\n2. Execute core methodology\n3. Validate results with standard benchmarks`,
    complexity: 'High Reliability & Standard Compliance',
    commonMistakes: [
      'Jumping into conclusions without clarifying constraints',
      'Ignoring standard regulatory / safety guidelines',
    ],
    interviewTip: 'Always structure your answer clearly and state your assumptions before answering.',
  };
}

// Global Error-Handling Middleware (Ensures Serverless/Express always returns JSON, never HTML 500)
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[Unhandled Server Error in Express]', err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(err.status || 500).json({
    success: false,
    message: err?.message || 'An unexpected server error occurred.',
  });
});

async function startServer() {
  // Connect to MongoDB with resilient lifecycle management
  await connectDB();

  // Initialize seeded accounts with bcrypt hashing if not present
  await seedAuthUsers();

  // Create HTTP server instance to share with Vite HMR (avoids standalone port 24678 conflict)
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n  🚀 Smart AI Universal Interview Server is live!');
    console.log('  ➜ Local:     http://localhost:' + PORT);
    console.log('  ➜ Network:   http://127.0.0.1:' + PORT);
    console.log('  ➜ DB Health: http://localhost:' + PORT + '/api/db/health\n');

    // Automatically open in Google Chrome on local startup
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      openChromeBrowser(`http://localhost:${PORT}`);
    }
  });

  httpServer.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.error('\n⚠️  [Port Conflict] Port ' + PORT + ' is already in use by another running process.');
      console.error('👉 To free port ' + PORT + ' on Windows PowerShell, run:');
      console.error('   Get-NetTCPConnection -LocalPort ' + PORT + ' | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n');
    } else {
      console.error('Server error:', err);
    }
  });
}

/**
 * Automatically launches Google Chrome pointing to the application URL.
 * Works seamlessly across Windows, macOS, and Linux.
 */
function openChromeBrowser(url: string) {
  if (process.env.AUTO_OPEN_BROWSER === 'false' || process.env.CI) {
    return;
  }

  // Small delay ensures Vite HMR and server routes are fully listening
  setTimeout(() => {
    const platform = process.platform;
    console.log(`  🌐 Launching Google Chrome: ${url}\n`);

    if (platform === 'win32') {
      // 1. Windows: Try 'start chrome' (resolves via Windows App Paths registry)
      exec(`start chrome "${url}"`, (err) => {
        if (err) {
          // 2. Fallback to standard Google Chrome install directories on Windows
          const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
          ];
          const foundChrome = chromePaths.find((p) => p && fs.existsSync(p));
          if (foundChrome) {
            exec(`"${foundChrome}" "${url}"`, (fbErr) => {
              if (fbErr) {
                exec(`start "" "${url}"`);
              }
            });
          } else {
            // General fallback to system default browser
            exec(`start "" "${url}"`);
          }
        }
      });
    } else if (platform === 'darwin') {
      // macOS: open using Google Chrome app
      exec(`open -a "Google Chrome" "${url}"`, (err) => {
        if (err) exec(`open "${url}"`);
      });
    } else {
      // Linux: try standard chrome binaries, fallback to xdg-open
      exec(`google-chrome "${url}"`, (err) => {
        if (err) {
          exec(`google-chrome-stable "${url}" || xdg-open "${url}"`);
        }
      });
    }
  }, 400);
}

// Start HTTP server only in non-serverless environments (like local machine)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app, startServer };
