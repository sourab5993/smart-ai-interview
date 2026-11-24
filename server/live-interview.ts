import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { analyzeInterview, evaluateAnswer } from "./ai";

type Ctx = Pick<TrpcContext, "user" | "accessToken">;
type LocalFramingSummary = {
  version: "local-framing-v1";
  sample_count: number;
  face_present: number;
  shoulders_present: number;
  hands_present: number;
};
type Session = {
  id: string;
  owner_id: string;
  target_role: string;
  duration_minutes: number;
  speech_language: string;
  status: string;
  started_at: string;
  deadline_at: string;
  completed_at: string | null;
  camera_summary?: LocalFramingSummary | null;
  report: any;
  report_error?: string | null;
  created_at?: string;
  updated_at?: string;
};
type Turn = {
  id: string;
  session_id: string;
  turn_index: number;
  question_text: string;
  question_type: string;
  difficulty: string;
  competencies: any;
  parent_turn_id: string | null;
  transcript: string | null;
  transcript_status: string;
  evaluation: any;
  evaluation_status: string;
  idempotency_key: string;
};
type SessionSummary = Pick<
  Session,
  | "id"
  | "target_role"
  | "duration_minutes"
  | "status"
  | "started_at"
  | "deadline_at"
  | "completed_at"
> & {
  updated_at?: string;
  report_error?: string | null;
};
export const STALE_FINALIZING_TIMEOUT_MS = 45_000;

export function isFinalizingStale(
  session: { status: string; updated_at?: string; started_at?: string },
  now = Date.now()
) {
  if (session.status !== "finalizing") return false;
  const ts = session.updated_at || session.started_at;
  if (!ts) return false;
  return now - Date.parse(ts) >= STALE_FINALIZING_TIMEOUT_MS;
}

export function hasLiveInterviewDeadlineElapsed(
  deadlineAt: string,
  now = Date.now()
) {
  return now >= Date.parse(deadlineAt);
}
export function canEvaluateLiveTurn(sessionStatus: string) {
  return sessionStatus === "in_progress";
}
function config(ctx: Ctx) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  const token = ctx.accessToken;
  if (!base || !key || !token || !ctx.user)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Your session expired. Sign in again.",
    });
  return { base, key, token };
}
async function rest<T>(
  ctx: Ctx,
  table: string,
  query = "",
  init: RequestInit = {}
): Promise<T> {
  const { base, key, token } = config(ctx);
  let r: Response;
  try {
    r = await fetch(`${base}/rest/v1/${table}${query}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      signal: init.signal || AbortSignal.timeout(12000),
    });
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Interview storage is temporarily unavailable.",
    });
  }
  const text = await r.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  if (!r.ok) {
    const m = String(body?.message || "");
    const conflict = r.status === 409 || /deadline|not accepting/i.test(m);
    throw new TRPCError({
      code: conflict
        ? "CONFLICT"
        : r.status === 404
          ? "NOT_FOUND"
          : r.status === 401 || r.status === 403
            ? "FORBIDDEN"
            : "SERVICE_UNAVAILABLE",
      message: conflict
        ? "The session deadline has passed or this session can no longer accept that action."
        : r.status === 404
          ? "Live Interview not found."
          : "Interview storage request failed.",
    });
  }
  return body as T;
}
const enc = (s: string) => encodeURIComponent(s);
const owner = (ctx: Ctx) => `owner_id=eq.${enc(ctx.user!.id)}`;
async function sessionFor(ctx: Ctx, id: string) {
  const rows = await rest<Session[]>(
    ctx,
    "live_interview_sessions",
    `?id=eq.${enc(id)}&${owner(ctx)}&select=*&limit=1`
  );
  if (!rows[0])
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Live Interview session not found.",
    });
  return rows[0];
}
async function turnsFor(ctx: Ctx, id: string) {
  return rest<Turn[]>(
    ctx,
    "live_interview_turns",
    `?session_id=eq.${enc(id)}&${owner(ctx)}&select=*&order=turn_index.asc&limit=100`
  );
}
function accepting(s: Session) {
  if (
    s.status !== "in_progress" ||
    hasLiveInterviewDeadlineElapsed(s.deadline_at)
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "The interview deadline passed or this session has ended.",
    });
}
async function autoExpireStaleSession(
  ctx: Ctx,
  session: { id: string; status: string; updated_at?: string; started_at?: string }
): Promise<boolean> {
  if (!isFinalizingStale(session)) return false;
  try {
    await rest(
      ctx,
      "rpc/force_end_live_interview",
      "",
      {
        method: "POST",
        body: JSON.stringify({ p_session_id: session.id, p_status: "failed" }),
      }
    ).catch(async () => {
      await rest(
        ctx,
        "live_interview_sessions",
        `?id=eq.${enc(session.id)}&${owner(ctx)}&status=eq.finalizing`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "failed",
            report_error: "Finalization timed out. Retry finalization or force end.",
            updated_at: new Date().toISOString(),
          }),
        }
      );
    });
    return true;
  } catch {
    return false;
  }
}

export async function forceEndLiveSession(ctx: Ctx, id: string) {
  await rest(
    ctx,
    "rpc/force_end_live_interview",
    "",
    {
      method: "POST",
      body: JSON.stringify({ p_session_id: id, p_status: "abandoned" }),
    }
  ).catch(async () => {
    await rest(
      ctx,
      "live_interview_sessions",
      `?id=eq.${enc(id)}&${owner(ctx)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "abandoned",
          report_error: "Session ended by user.",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      }
    );
  });
  return { success: true as const, sessionId: id };
}

export async function createLiveSession(
  ctx: Ctx,
  input: { role: string; durationMinutes: number; speechLanguage: string }
) {
  const active = await rest<SessionSummary[]>(
    ctx,
    "live_interview_sessions",
    `?${owner(ctx)}&status=in.(in_progress,failed,finalizing)&select=id,status,deadline_at,started_at,updated_at&order=created_at.desc&limit=5`
  );

  for (const s of active) {
    if (s.status === "finalizing" && isFinalizingStale(s)) {
      await autoExpireStaleSession(ctx, s);
    }
  }

  // Only an un-expired in_progress session blocks creation
  const ongoing = active.find(
    s => s.status === "in_progress" && !hasLiveInterviewDeadlineElapsed(s.deadline_at)
  );
  if (ongoing)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Recover or finish your active Live Interview first.",
    });
  const rows = await rest<Session[]>(
    ctx,
    "live_interview_sessions?select=*",
    "",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        owner_id: ctx.user!.id,
        target_role: input.role.trim(),
        duration_minutes: input.durationMinutes,
        speech_language: input.speechLanguage.slice(0, 20),
      }),
    }
  );
  if (!rows[0])
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not create the interview session.",
    });
  return rows[0];
}
export async function getLiveSession(ctx: Ctx, id: string) {
  const session = await sessionFor(ctx, id);
  return { session, turns: await turnsFor(ctx, id) };
}
export async function getActiveLiveSession(ctx: Ctx) {
  const sessions = await rest<SessionSummary[]>(
    ctx,
    "live_interview_sessions",
    `?${owner(ctx)}&status=in.(in_progress,failed,finalizing)&select=id,target_role,duration_minutes,status,started_at,deadline_at,updated_at&order=created_at.desc&limit=1`
  );
  const session = sessions[0];
  if (!session) return null;

  if (session.status === "finalizing" && isFinalizingStale(session)) {
    await autoExpireStaleSession(ctx, session);
    return null;
  }

  return session;
}
export async function listLiveSessions(ctx: Ctx) {
  return rest<
    Array<
      Pick<
        Session,
        | "id"
        | "target_role"
        | "duration_minutes"
        | "status"
        | "started_at"
        | "deadline_at"
        | "completed_at"
      >
    >
  >(
    ctx,
    "live_interview_sessions",
    `?${owner(ctx)}&select=id,target_role,duration_minutes,status,started_at,deadline_at,completed_at&order=created_at.desc&limit=50`
  );
}
export async function saveLiveQuestion(
  ctx: Ctx,
  i: {
    sessionId: string;
    turnIndex: number;
    question: string;
    type: string;
    difficulty: string;
    competencies: string[];
    parentTurnId?: string;
    idempotencyKey: string;
  }
) {
  const s = await sessionFor(ctx, i.sessionId);
  accepting(s);
  const saved = await rest<Turn | null>(
    ctx,
    "rpc/save_live_interview_question",
    "",
    {
      method: "POST",
      body: JSON.stringify({
        p_session_id: i.sessionId,
        p_turn_index: i.turnIndex,
        p_question_text: i.question.trim().slice(0, 2000),
        p_question_type: i.type.slice(0, 80),
        p_difficulty: i.difficulty.slice(0, 30),
        p_competencies: i.competencies.slice(0, 12),
        p_parent_turn_id: i.parentTurnId || null,
        p_idempotency_key: i.idempotencyKey,
      }),
    }
  );
  if (!saved)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "The interview is finalizing or its server deadline has elapsed; no new question was saved.",
    });
  return saved;
}
export async function saveLiveTranscript(
  ctx: Ctx,
  i: { sessionId: string; turnId: string; transcript: string }
) {
  const s = await sessionFor(ctx, i.sessionId);
  accepting(s);
  const transcript = i.transcript.trim().slice(0, 12000);
  if (!transcript)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No recognized speech was received.",
    });
  const saved = await rest<boolean>(
    ctx,
    "rpc/save_live_interview_transcript",
    "",
    {
      method: "POST",
      body: JSON.stringify({
        p_session_id: i.sessionId,
        p_turn_id: i.turnId,
        p_transcript: transcript,
      }),
    }
  );
  if (!saved)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "The interview is finalizing or its server deadline has elapsed; the transcript was not accepted.",
    });
  return { accepted: true as const };
}

export async function saveLiveCameraSummary(
  ctx: Ctx,
  i: { sessionId: string; summary: LocalFramingSummary }
) {
  const session = await sessionFor(ctx, i.sessionId);
  if (session.status !== "in_progress")
    throw new TRPCError({
      code: "CONFLICT",
      message: "This interview no longer accepts optional camera metadata.",
    });
  const { summary } = i;
  const values = [
    summary.sample_count,
    summary.face_present,
    summary.shoulders_present,
    summary.hands_present,
  ];
  if (
    summary.version !== "local-framing-v1" ||
    !values.every(Number.isSafeInteger) ||
    summary.sample_count < 1 ||
    summary.sample_count > 10000 ||
    values.slice(1).some(value => value < 0 || value > summary.sample_count)
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The optional framing summary is invalid.",
    });

  const saved = await rest<boolean>(
    ctx,
    "rpc/save_live_interview_camera_summary",
    "",
    {
      method: "POST",
      body: JSON.stringify({
        p_session_id: i.sessionId,
        p_summary: summary,
      }),
    }
  );
  if (!saved)
    throw new TRPCError({
      code: "CONFLICT",
      message: "This interview no longer accepts optional camera metadata.",
    });
  return { saved: true as const };
}

export async function evaluateLiveTurn(
  ctx: Ctx,
  i: { sessionId: string; turnId: string }
) {
  const s = await sessionFor(ctx, i.sessionId);
  if (!canEvaluateLiveTurn(s.status))
    throw new TRPCError({
      code: "CONFLICT",
      message: "This interview is finalizing or has already ended.",
    });
  const rows = await rest<Turn[]>(
    ctx,
    "live_interview_turns",
    `?id=eq.${enc(i.turnId)}&session_id=eq.${enc(i.sessionId)}&${owner(ctx)}&select=*&limit=1`
  );
  const t = rows[0];
  if (!t?.transcript || t.transcript_status !== "accepted")
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Save a recognized answer before evaluation.",
    });
  let result: Turn["evaluation"];
  try {
    result =
      t.evaluation_status === "completed" && t.evaluation?.source === "ai"
        ? t.evaluation
        : await evaluateAnswer({
            question: t.question_text,
            answer: t.transcript,
            course: "General interview preparation",
            role: s.target_role,
            type: t.question_type,
            skills: Array.isArray(t.competencies)
              ? t.competencies.map(String).slice(0, 12)
              : [],
            language: s.speech_language,
          });
  } catch (evalErr: any) {
    console.error(
      `[evaluateLiveTurn] Evaluation failed for session ${i.sessionId}, turn ${i.turnId}:`,
      evalErr?.message || evalErr
    );
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: `Evaluation failed: ${evalErr?.message || "AI service temporarily unavailable."}`,
      cause: evalErr,
    });
  }
  if (!result || result.source !== "ai")
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "A verified AI evaluation is temporarily unavailable. Retry later.",
    });
  const saved = await rest<boolean>(
    ctx,
    "rpc/save_live_interview_evaluation",
    "",
    {
      method: "POST",
      body: JSON.stringify({
        p_session_id: i.sessionId,
        p_turn_id: t.id,
        p_evaluation: result,
      }),
    }
  );
  if (!saved)
    throw new TRPCError({
      code: "CONFLICT",
      message: "The interview began finalizing before this evaluation was saved.",
    });
  return result;
}
export async function finalizeLiveSession(
  ctx: Ctx,
  id: string,
  reason: "manual" | "deadline"
) {
  let s = await sessionFor(ctx, id);
  if (s.status === "completed")
    return { session: s, turns: await turnsFor(ctx, id) };
  if (reason === "deadline" && !hasLiveInterviewDeadlineElapsed(s.deadline_at))
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The server-side deadline has not elapsed.",
    });

  let claimToken: string | null = null;
  try {
    claimToken = await rest<string>(
      ctx,
      "rpc/claim_interview_finalization",
      "",
      {
        method: "POST",
        body: JSON.stringify({ p_session_kind: "live", p_session_id: id }),
      }
    );
  } catch {
    claimToken = null;
  }

  const isTokenFormatValid = (token: unknown): token is string =>
    typeof token === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);

  if (!isTokenFormatValid(claimToken)) {
    const current = await sessionFor(ctx, id);
    if (current.status === "completed")
      return { session: current, turns: await turnsFor(ctx, id) };

    if (isFinalizingStale(current)) {
      await autoExpireStaleSession(ctx, current);
      try {
        claimToken = await rest<string>(
          ctx,
          "rpc/claim_interview_finalization",
          "",
          {
            method: "POST",
            body: JSON.stringify({ p_session_kind: "live", p_session_id: id }),
          }
        );
      } catch {
        claimToken = null;
      }
    }

    if (!isTokenFormatValid(claimToken)) {
      const refreshed = await sessionFor(ctx, id);
      if (refreshed.status === "completed")
        return { session: refreshed, turns: await turnsFor(ctx, id) };
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This interview is already being finalized. Refresh in a moment to check its report.",
      });
    }
  }

  let finalized = false;
  try {
    const finalizingRows = await rest<{ id: string }[]>(
      ctx,
      "live_interview_sessions",
      `?id=eq.${enc(id)}&${owner(ctx)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "finalizing",
          report_error: null,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!finalizingRows.length)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This interview changed while finalization was starting. Refresh and try again.",
      });
    s = await sessionFor(ctx, id);
    let turns = await turnsFor(ctx, id);
    const unevaluated = turns.filter(
      t =>
        t.transcript &&
        t.transcript_status === "accepted" &&
        !(t.evaluation_status === "completed" && t.evaluation)
    );
    if (unevaluated.length) {
      await Promise.all(
        unevaluated.map(async t => {
          let e: any = null;
          try {
            e = await evaluateAnswer({
              question: t.question_text,
              answer: t.transcript!,
              course: "General interview preparation",
              role: s.target_role,
              type: t.question_type,
              skills: Array.isArray(t.competencies)
                ? t.competencies.map(String).slice(0, 12)
                : [],
              language: s.speech_language,
            });
          } catch (evalErr) {
            console.warn(`[LiveInterview Finalize] Turn ${t.id} evaluation fallback:`, evalErr);
          }
          if (e) {
            try {
              const saved = await rest<boolean>(
                ctx,
                "rpc/save_live_interview_finalized_turn",
                "",
                {
                  method: "POST",
                  body: JSON.stringify({
                    p_session_id: id,
                    p_turn_id: t.id,
                    p_claim_token: claimToken,
                    p_evaluation: e,
                  }),
                }
              );
              if (saved) {
                t.evaluation = e;
                t.evaluation_status = "completed";
              }
            } catch (saveErr) {
              console.warn(`[LiveInterview Finalize] Turn ${t.id} save notice:`, saveErr);
              t.evaluation = e;
              t.evaluation_status = "completed";
            }
          }
        })
      );
    }
    if (unevaluated.length) {
      turns = await turnsFor(ctx, id);
    }
    const scored = turns.filter(
      t =>
        t.transcript &&
        t.transcript_status === "accepted" &&
        t.evaluation_status === "completed" &&
        t.evaluation
    );
    let analysis: any = null;
    try {
      analysis = scored.length
        ? await analyzeInterview({
            course: "General interview preparation",
            role: s.target_role,
            answers: scored.slice(0, 12).map(t => ({
              question: t.question_text,
              answer: t.transcript!,
              score: Number(t.evaluation.overall_score),
            })),
          })
        : {
            summary: "No answers were evaluated. No score is available.",
            modelVersion: null,
            promptVersion: null,
            strengths: [],
            weaknesses: [],
            communication_issues: [],
            repeated_mistakes: [],
            missing_concepts: [],
            next_steps: [],
          };
    } catch (analysisErr) {
      console.warn("[LiveInterview Finalize] analyzeInterview fallback:", analysisErr);
      const avg = scored.length
        ? Math.round(
            scored
              .map(t => Number(t.evaluation.overall_score) || 0)
              .reduce((a, b) => a + b, 0) / scored.length
          )
        : null;
      analysis = {
        summary: `You completed practice for ${s.target_role}. Across ${scored.length} response(s), overall performance averaged ${avg !== null ? `${avg}/100` : "unrated"}.`,
        modelVersion: null,
        promptVersion: null,
        strengths: ["Completed practice session under timed interview conditions"],
        weaknesses: ["Review individual answers for depth, clarity, and metric grounding"],
        communication_issues: [],
        repeated_mistakes: [],
        missing_concepts: [],
        next_steps: ["Review individual answer feedback and continue practicing"],
      };
    }
    const nums = scored
      .map(t => Number(t.evaluation.overall_score))
      .filter(n => Number.isFinite(n) && n >= 0 && n <= 100);
    const report = {
      version: "live-report-v2",
      role: s.target_role,
      durationMinutes: s.duration_minutes,
      startedAt: s.started_at,
      deadlineAt: s.deadline_at,
      completedAt: new Date().toISOString(),
      completionReason: reason,
      questionCount: turns.length,
      answeredCount: turns.filter(t => !!t.transcript).length,
      evaluatedCount: scored.length,
      cameraSummary: s.camera_summary ?? null,
      answerQualityScore: nums.length
        ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
        : null,
      evaluationModelVersion: scored[0]?.evaluation?.modelVersion ?? null,
      evaluationPromptVersion: scored[0]?.evaluation?.promptVersion ?? null,
      rubricVersion: scored[0]?.evaluation?.rubricVersion ?? null,
      analysisSource: scored.length ? (analysis.modelVersion ? "ai" : "transparent-baseline") : "transparent-baseline",
      analysisModelVersion: analysis.modelVersion ?? null,
      analysisPromptVersion: analysis.promptVersion ?? null,
      analysis,
      turns: turns.map(t => ({
        id: t.id,
        question: t.question_text,
        questionType: t.question_type,
        difficulty: t.difficulty,
        transcript: t.transcript,
        transcriptStatus: t.transcript_status,
        evaluation: t.evaluation_status === "completed" ? t.evaluation : null,
        evaluationStatus: t.evaluation_status,
      })),
      limitations: [
        "Speech recognition is browser-provided; quality varies by browser, language, accent and environment.",
        "AI scores are coaching estimates, not validated hiring metrics.",
        "Per-answer scores are weighted aggregations of supported rubric dimensions; weights are normalized over dimensions returned.",
        "Narrative summary uses up to 12 answers; per-turn evaluation is retained for all turns.",
        "Optional local framing observations are factual sample counts only; no webcam frames or landmarks are uploaded, and they never affect answer-quality scores.",
      ],
    };
    const completed = await rest<boolean>(
      ctx,
      "rpc/complete_live_interview_with_claim",
      "",
      {
        method: "POST",
        body: JSON.stringify({
          p_session_id: id,
          p_claim_token: claimToken,
          p_report: report,
        }),
      }
    );
    if (!completed) {
      const current = await sessionFor(ctx, id);
      if (current.status === "completed") {
        finalized = true;
        return { session: current, turns: await turnsFor(ctx, id) };
      }
      try {
        await rest(
          ctx,
          "live_interview_sessions",
          `?id=eq.${enc(id)}&${owner(ctx)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              status: "completed",
              report,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
          }
        );
        finalized = true;
        const [finalSession, finalTurns] = await Promise.all([
          sessionFor(ctx, id),
          turnsFor(ctx, id),
        ]);
        return { session: finalSession, turns: finalTurns };
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "The report was prepared, but its finalization lease or session status changed. Refresh and retry.",
        });
      }
    }
    finalized = true;
    const [finalSession, finalTurns] = await Promise.all([
      sessionFor(ctx, id),
      turnsFor(ctx, id),
    ]);
    return { session: finalSession, turns: finalTurns };
  } catch (error) {
    // Immediately clear finalizing state in DB so the session is never left locked
    await rest(
      ctx,
      "live_interview_sessions",
      `?id=eq.${enc(id)}&${owner(ctx)}&status=eq.finalizing`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          report_error: "Live Interview evaluation/report failed; retry allowed.",
          updated_at: new Date().toISOString(),
        }),
      }
    ).catch(() => undefined);

    if (claimToken) {
      await rest(
        ctx,
        "rpc/release_interview_finalization",
        "",
        {
          method: "POST",
          body: JSON.stringify({
            p_session_kind: "live",
            p_session_id: id,
            p_claim_token: claimToken,
            p_failure_message: "Live Interview evaluation/report failed; retry allowed.",
          }),
        }
      ).catch(() => undefined);
    }
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Answers are saved, but evaluation/report generation failed. Retry finalization.",
    });
  } finally {
    if (!finalized) {
      // Ensure session does not stay in 'finalizing' on any unhandled failure
      await rest(
        ctx,
        "live_interview_sessions",
        `?id=eq.${enc(id)}&${owner(ctx)}&status=eq.finalizing`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "failed",
            report_error: "Finalization interrupted. Retry finalization or force end.",
            updated_at: new Date().toISOString(),
          }),
        }
      ).catch(() => undefined);
    }
  }
}
