import { Router, Request, Response } from 'express';
import { getGeminiClient, callGemini, transcribeAudioGemini } from '../services/geminiService';
import {
  generateFallbackQuestions,
  evaluateFallbackAnswer,
  generateFallbackReport,
  generateFallbackResumeAnalysis,
  generateFallbackJobMatch,
  generateFallbackExplanation,
} from '../services/fallbackEngines';

const router = Router();

// 1. Generate Interview Questions (Universal for ANY Course / Specialization / Role)
router.post('/generate-questions', async (req: Request, res: Response) => {
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

// 2. Universal AI Evaluation (Strict Multi-Course Grading)
router.post('/evaluate-answer', async (req: Request, res: Response) => {
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
    behaviorTelemetry,
  } = req.body;

  if (!userAnswer || userAnswer.trim().length === 0) {
    return res.status(400).json({ error: 'User answer is required.' });
  }

  const ai = getGeminiClient();

  if (!ai) {
    const fallbackEval = evaluateFallbackAnswer(question, userAnswer, course, role, type, behaviorTelemetry);
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
- Live Candidate Non-Verbal Telemetry (Webcam Computer Vision): ${
  behaviorTelemetry
    ? `Eye Contact: ${behaviorTelemetry.eyeContactScore}%, Posture Stability: ${behaviorTelemetry.postureStabilityScore}%, Composure: ${behaviorTelemetry.facialComposureScore}%, Observations: ${(behaviorTelemetry.behaviorNotes || []).join('; ') || 'Natural non-verbal composure'}`
    : 'Webcam inactive / speech evaluation only'
}

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
9. behavior_score (non-verbal delivery, eye contact consistency, and posture composure: score 0-100)

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
  "behavior_score": number,
  "non_verbal_feedback": "string (1-2 sentences assessing eye contact, body language, and non-verbal confidence)",
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
      evaluation = match ? JSON.parse(match[0]) : evaluateFallbackAnswer(question, userAnswer, course, role, type, behaviorTelemetry);
    }

    if (evaluation) {
      if (behaviorTelemetry) {
        evaluation.behavior_score = behaviorTelemetry.overallBehaviorScore;
        evaluation.behavior_telemetry = behaviorTelemetry;
        if (behaviorTelemetry.behaviorNotes && behaviorTelemetry.behaviorNotes.length > 0) {
          evaluation.non_verbal_feedback = behaviorTelemetry.behaviorNotes.join(' ');
        }
      } else {
        evaluation.behavior_score = evaluation.behavior_score ?? 0;
        evaluation.non_verbal_feedback =
          evaluation.non_verbal_feedback || 'Webcam monitoring was inactive during this answer.';
      }
    }

    return res.json({ success: true, evaluation, source: modelUsed });
  } catch (error: any) {
    console.error('Error evaluating answer:', error);
    const fallbackEval = evaluateFallbackAnswer(question, userAnswer, course, role, type, behaviorTelemetry);
    return res.json({ success: true, evaluation: fallbackEval, source: 'fallback_error_recovery' });
  }
});

// 3. Analyze Full Interview (Universal Multi-Course Synthesis)
router.post('/analyze-interview', async (req: Request, res: Response) => {
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
  "behaviorScore": number (0-100 non-verbal executive presence index),
  "eyeContactAverage": number (0-100),
  "postureStabilityAverage": number (0-100),
  "composureAverage": number (0-100),
  "behaviorSummary": "string (assessment of candidate eye contact, posture, and facial composure)",
  "nonVerbalRecommendations": ["string"],
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

    // Ensure non-verbal behavioral metrics are present
    const bTelemetries = (session.questions || [])
      .map((q: any) => q.behaviorTelemetry || q.evaluation?.behavior_telemetry)
      .filter(Boolean);
    const avgEye = bTelemetries.length > 0
      ? Math.round(bTelemetries.reduce((acc: number, t: any) => acc + (t.eyeContactScore ?? 0), 0) / bTelemetries.length)
      : 0;
    const avgStab = bTelemetries.length > 0
      ? Math.round(bTelemetries.reduce((acc: number, t: any) => acc + (t.postureStabilityScore ?? 0), 0) / bTelemetries.length)
      : 0;
    const avgComp = bTelemetries.length > 0
      ? Math.round(bTelemetries.reduce((acc: number, t: any) => acc + (t.facialComposureScore ?? 0), 0) / bTelemetries.length)
      : 0;
    const compositeBehavior = Math.round(avgEye * 0.4 + avgStab * 0.3 + avgComp * 0.3);

    if (report.behaviorScore === undefined || report.behaviorScore === null) {
      report.behaviorScore = compositeBehavior;
    }
    if (report.eyeContactAverage === undefined || report.eyeContactAverage === null) {
      report.eyeContactAverage = avgEye;
    }
    if (report.postureStabilityAverage === undefined || report.postureStabilityAverage === null) {
      report.postureStabilityAverage = avgStab;
    }
    if (report.composureAverage === undefined || report.composureAverage === null) {
      report.composureAverage = avgComp;
    }
    if (!report.behaviorSummary) {
      report.behaviorSummary = bTelemetries.length > 0
        ? `Candidate maintained an average eye contact score of ${avgEye}%, posture stability of ${avgStab}%, and facial composure of ${avgComp}%. Non-verbal presence was composed and focused.`
        : `Camera telemetry was not recorded during this interview session; non-verbal metrics unrecorded.`;
    }
    if (!report.nonVerbalRecommendations || report.nonVerbalRecommendations.length === 0) {
      report.nonVerbalRecommendations = [
        'Maintain direct eye contact with the camera lens when presenting key conclusions.',
        'Adopt an open, upright seated posture to project executive presence.',
        'Allow natural micro-gestures to emphasize important structural points.',
      ];
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
router.post('/analyze-resume', async (req: Request, res: Response) => {
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

// 5. Match Job Description vs Resume (Universal)
router.post('/match-job', async (req: Request, res: Response) => {
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
router.post('/explain-question', async (req: Request, res: Response) => {
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
router.post('/transcribe-audio', async (req: Request, res: Response) => {
  const { audioBase64 = '', mimeType = 'audio/webm', language = 'English' } = req.body;

  if (!audioBase64 || audioBase64.length < 50) {
    return res.status(400).json({ success: false, error: 'Valid audio data is required.' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({ success: false, error: 'AI client not configured.' });
  }

  try {
    const { text, source } = await transcribeAudioGemini(ai, audioBase64, mimeType, language);
    return res.json({ success: true, text, source });
  } catch (error: any) {
    console.error('Error transcribing audio with Gemini:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Audio transcription failed' });
  }
});

export default router;
