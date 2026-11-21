import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

type Ctx = Pick<TrpcContext, "user" | "accessToken">;

function config(ctx: Ctx) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !process.env.SUPABASE_ANON_KEY || !ctx.user || !ctx.accessToken)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Your session has expired. Please sign in again." });
  return { base, key: process.env.SUPABASE_ANON_KEY, token: ctx.accessToken };
}

async function rest<T>(ctx: Ctx, table: string, query = "", init: RequestInit = {}): Promise<T> {
  const { base, key, token } = config(ctx);
  let response: Response;
  try {
    response = await fetch(`${base}/rest/v1/${table}${query}`, {
      ...init,
      signal: init.signal || AbortSignal.timeout(15_000),
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The interview data service could not be reached. Your saved answers are unchanged; please retry." });
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "The interview data service timed out while reading the response. Your saved answers are unchanged; please retry." });
  }
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const code = response.status === 401 ? "UNAUTHORIZED"
      : response.status === 403 ? "FORBIDDEN"
      : response.status === 429 ? "TOO_MANY_REQUESTS"
      : response.status >= 500 ? "SERVICE_UNAVAILABLE"
      : "BAD_REQUEST";
    const message = response.status === 401
      ? "Your session has expired. Please sign in again."
      : response.status === 403
        ? "You do not have permission to access this interview data."
        : response.status === 429
          ? "Too many interview requests were received. Wait briefly and retry."
          : response.status >= 500
            ? "The interview data service is temporarily unavailable. Your saved answers are unchanged; please retry."
            : "The interview request could not be completed. Your saved answers are unchanged.";
    throw new TRPCError({
      code,
      message,
    });
  }
  return body as T;
}

function inList(values: string[]) {
  return `(${values.map(value => encodeURIComponent(value)).join(",")})`;
}

export type EligibleQuestion = {
  id: string;
  session_id: string;
  question_text: string;
  topic: string;
  difficulty: string;
  rationale: string;
  sort_order: number;
  session: {
    id: string;
    target_role: string;
    interview_type: string;
    difficulty: string;
    created_at: string;
    completed_at: string | null;
    overall_score: number | null;
    question_count: number;
  };
};

export async function getEligibleQuestions(ctx: Ctx): Promise<{ sessions: EligibleQuestion["session"][]; questions: EligibleQuestion[] }> {
  const sessions = await rest<any[]>(ctx, "interview_sessions", `?owner_id=eq.${ctx.user!.id}&status=eq.completed&select=id,target_role,interview_type,difficulty,created_at,completed_at,overall_score,question_count&order=created_at.desc&limit=100`);
  if (!sessions.length) return { sessions: [], questions: [] };
  const sessionIds = sessions.map(session => session.id);
  const questions = await rest<any[]>(ctx, "interview_questions", `?owner_id=eq.${ctx.user!.id}&session_id=in.${inList(sessionIds)}&select=id,session_id,question_text,topic,difficulty,rationale,sort_order&order=session_id.asc,sort_order.asc&limit=500`);
  const byId = new Map(sessions.map(session => [session.id, session]));
  return {
    sessions,
    questions: questions.map(question => ({ ...question, session: byId.get(question.session_id) })).filter(question => question.session),
  };
}

export async function createBehavioralSession(
  ctx: Ctx,
  input: {
    selectedQuestions: Array<{ sourceSessionId: string; sourceQuestionId: string }>;
    generatedQuestions: Array<{ question: string; topic: string; difficulty: string; rationale: string }>;
    includeAnswerEvaluation: boolean;
    consent: Record<string, unknown>;
    modelMetadata: Record<string, unknown>;
  }
) {
  const usingGenerated = input.generatedQuestions.length > 0;
  if (!usingGenerated && (input.selectedQuestions.length < 1 || input.selectedQuestions.length > 20))
    throw new TRPCError({ code: "BAD_REQUEST", message: "Generate between 1 and 20 questions." });
  if (usingGenerated && (input.generatedQuestions.length < 1 || input.generatedQuestions.length > 10))
    throw new TRPCError({ code: "BAD_REQUEST", message: "Generate between 1 and 10 questions." });
  const { user } = ctx;
  const sourceSessionIds = usingGenerated ? [] : [...new Set(input.selectedQuestions.map(item => item.sourceSessionId))];
  let sourceQuestions: any[] = [];
  if (!usingGenerated) {
    const questionIds = input.selectedQuestions.map(item => item.sourceQuestionId);
    sourceQuestions = await rest<any[]>(ctx, "interview_questions", `?owner_id=eq.${user!.id}&id=in.${inList(questionIds)}&session_id=in.${inList(sourceSessionIds)}&select=id,session_id,question_text,topic,difficulty,rationale,sort_order&limit=50`);
    if (sourceQuestions.length !== input.selectedQuestions.length)
      throw new TRPCError({ code: "FORBIDDEN", message: "One or more selected questions are not available in your account." });
    const allowed = new Set(input.selectedQuestions.map(item => `${item.sourceSessionId}:${item.sourceQuestionId}`));
    if (sourceQuestions.some(question => !allowed.has(`${question.session_id}:${question.id}`)))
      throw new TRPCError({ code: "FORBIDDEN", message: "Selected question ownership could not be verified." });
    const sourceSessions = await rest<any[]>(ctx, "interview_sessions", `?owner_id=eq.${user!.id}&id=in.${inList(sourceSessionIds)}&status=eq.completed&select=id&limit=50`);
    if (sourceSessions.length !== sourceSessionIds.length)
      throw new TRPCError({ code: "FORBIDDEN", message: "Only completed interviews can be used for behavioral practice." });
  }

  const created = await rest<any[]>(ctx, "behavioral_sessions", "?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: user!.id,
      source_session_id: sourceSessionIds.length === 1 ? sourceSessionIds[0] : null,
      status: "in_progress",
      include_answer_evaluation: input.includeAnswerEvaluation,
      consent: input.consent,
      model_metadata: input.modelMetadata,
      started_at: new Date().toISOString(),
    }),
  });
  const session = created[0];
  if (!session?.id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Behavioral session could not be created." });
  const ordered = usingGenerated
    ? input.generatedQuestions.map((question, index) => ({
      owner_id: user!.id,
      behavioral_session_id: session.id,
      source_session_id: null,
      source_question_id: null,
      question_text: question.question,
      topic: question.topic || "General",
      difficulty: question.difficulty || "Medium",
      rationale: question.rationale || "Generated for this behavioral coaching session.",
      sort_order: index,
    }))
    : input.selectedQuestions
      .map(selected => sourceQuestions.find(question => question.id === selected.sourceQuestionId))
      .filter(Boolean)
      .map((question: any, index) => ({
      owner_id: user!.id,
      behavioral_session_id: session.id,
      source_session_id: question.session_id,
      source_question_id: question.id,
      question_text: question.question_text,
      topic: question.topic || "",
      difficulty: question.difficulty || "Medium",
      rationale: question.rationale || "",
      sort_order: index,
      }));
  try {
    await rest(ctx, "behavioral_questions", "", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(ordered),
    });
  } catch (error) {
    await rest(ctx, "behavioral_sessions", `?id=eq.${session.id}&owner_id=eq.${user!.id}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
  return { id: session.id };
}

export async function getBehavioralSession(ctx: Ctx, id: string) {
  const sessions = await rest<any[]>(ctx, "behavioral_sessions", `?id=eq.${encodeURIComponent(id)}&owner_id=eq.${ctx.user!.id}&select=*&limit=1`);
  if (!sessions[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Behavioral session not found." });
  const questions = await rest<any[]>(ctx, "behavioral_questions", `?behavioral_session_id=eq.${encodeURIComponent(id)}&owner_id=eq.${ctx.user!.id}&select=*&order=sort_order.asc`);
  const answers = await rest<any[]>(ctx, "behavioral_answers", `?behavioral_session_id=eq.${encodeURIComponent(id)}&owner_id=eq.${ctx.user!.id}&select=*&order=created_at.asc`);
  return { session: sessions[0], questions, answers };
}

export async function saveBehavioralAnswer(
  ctx: Ctx,
  input: {
    sessionId: string;
    questionId: string;
    transcript: string | null;
    transcriptLanguage: string | null;
    transcriptConfidence: number | null;
    durationSeconds: number;
    startedAt: string;
    endedAt: string;
    observationSummary: Record<string, unknown>;
    observations: Array<{ observedAtMs: number; observationType: string; payload: Record<string, unknown>; valid: boolean; reliability: number | null }>;
  }
) {
  const { user } = ctx;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your session has expired. Please sign in again." });
  if (!input.transcript?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No speech was recognized for that answer. Retry transcription before saving it." });
  }
  const answerId = await rest<string>(ctx, "rpc/save_behavioral_answer", "", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: input.sessionId,
      p_question_id: input.questionId,
      p_transcript: input.transcript?.trim() || null,
      p_transcript_language: input.transcriptLanguage || null,
      p_transcript_confidence: input.transcriptConfidence,
      p_duration_seconds: input.durationSeconds,
      p_started_at: input.startedAt,
      p_ended_at: input.endedAt,
      p_observation_summary: input.observationSummary,
      p_observations: input.observations.slice(0, 600).map(observation => ({
        observed_at_ms: observation.observedAtMs,
        observation_type: observation.observationType,
        payload: observation.payload,
        valid: observation.valid,
        reliability: observation.reliability,
      })),
    }),
  });
  return { id: answerId || null };
}

export async function completeBehavioralSession(ctx: Ctx, id: string) {
  const savedSummary = await rest<Record<string, unknown>>(ctx, "rpc/complete_behavioral_session", "", {
    method: "POST",
    body: JSON.stringify({ p_session_id: id }),
  });
  return { ...savedSummary, sessionId: id };
}

export async function getBehavioralReport(ctx: Ctx, id: string) {
  const data = await getBehavioralSession(ctx, id);
  if (data.session.status !== "completed")
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete the behavioral session before viewing its report." });
  const events = data.answers.flatMap(answer => Array.isArray(answer.observation_summary?.events) ? answer.observation_summary.events : []);
  return { ...data, events };
}
