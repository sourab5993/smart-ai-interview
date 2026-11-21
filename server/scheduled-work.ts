import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  AI_MODEL,
  QUESTION_PROMPT_VERSION,
  analyzeInterview,
  evaluateAnswer,
} from "./ai";
import {
  SCHEDULED_GEMINI_SUBJECT,
  withGeminiUser,
} from "./_core/gemini-rate-limit";
import {
  requireExactlyOneRow,
  withActiveFinalizationLease,
} from "./finalization-lease";
import { verifiedPostgresOptions } from "./_core/database";

export type GeneratedBankQuestion = {
  question: string;
  topic: string;
  difficulty: string;
  rationale: string;
  category: string;
  questionCategory: string;
  interviewType: string;
  course: string;
  role: string;
};
export type QuestionGenerator = (input: {
  count: number;
  model: string;
}) => Promise<GeneratedBankQuestion[]>;
export type WorkAdapters = {
  generateQuestions: QuestionGenerator;
  evaluate: typeof evaluateAnswer;
  analyze: typeof analyzeInterview;
  pool?: Pool;
};
export const normalizeQuestion = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
export function filterDuplicateQuestions<T extends { question: string }>(
  rows: T[],
  existing: string[] = []
): T[] {
  const accepted = existing.map(normalizeQuestion).filter(Boolean);
  const out: T[] = [];
  for (const row of rows) {
    const q = normalizeQuestion(row.question);
    if (
      q.length < 15 ||
      accepted.some(old => old === q || similarity(old, q) >= 0.88)
    )
      continue;
    accepted.push(q);
    out.push(row);
  }
  return out;
}
const COURSE_CATEGORY_SLUGS = new Set([
  "engineering",
  "medical",
  "management",
  "commerce",
  "science",
  "arts",
  "law",
  "design",
  "education",
  "hospitality",
  "agriculture",
  "vocational",
  "other",
]);
const QUESTION_CATEGORY_NAMES = new Set([
  "Basic",
  "Intermediate",
  "Advanced",
  "Scenario-based",
  "Problem-solving",
  "Case-based",
  "Application-based",
  "Conceptual",
]);
const INTERVIEW_TYPE_NAMES = new Set([
  "HR",
  "Technical",
  "Domain",
  "Behavioral",
  "Situational",
  "Case Study",
  "Coding",
  "Viva",
  "Communication",
  "Aptitude",
  "Mixed",
]);
export function balanceQuestionBank<T extends { category: string; difficulty: string }>(
  rows: T[],
  limit: number
): T[] {
  const remaining = [...rows];
  const selected: T[] = [];
  const categoryCounts = new Map<string, number>();
  const difficultyCounts = new Map<string, number>();
  while (remaining.length && selected.length < limit) {
    let bestIndex = 0;
    for (let index = 1; index < remaining.length; index++) {
      const candidate = remaining[index];
      const best = remaining[bestIndex];
      const candidateCategoryCount = categoryCounts.get(candidate.category) ?? 0;
      const bestCategoryCount = categoryCounts.get(best.category) ?? 0;
      const candidateDifficultyCount = difficultyCounts.get(candidate.difficulty) ?? 0;
      const bestDifficultyCount = difficultyCounts.get(best.difficulty) ?? 0;
      if (
        candidateCategoryCount < bestCategoryCount ||
        (candidateCategoryCount === bestCategoryCount &&
          candidateDifficultyCount < bestDifficultyCount)
      ) {
        bestIndex = index;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    selected.push(next);
    categoryCounts.set(next.category, (categoryCounts.get(next.category) ?? 0) + 1);
    difficultyCounts.set(
      next.difficulty,
      (difficultyCounts.get(next.difficulty) ?? 0) + 1
    );
  }
  return selected;
}
function similarity(a: string, b: string) {
  const aa = new Set(a.split(" "));
  const bb = new Set(b.split(" "));
  const union = new Set([...aa, ...bb]).size;
  return union ? [...aa].filter(x => bb.has(x)).length / union : 1;
}
export function isExpiredInProgress(
  status: string,
  deadline: string,
  now = Date.now()
) {
  const t = Date.parse(deadline);
  return status === "in_progress" && Number.isFinite(t) && now >= t;
}
export function completionAdjustedScore(
  scores: number[],
  evaluatedCount: number,
  questionCount: number
): number | null {
  const valid = scores.filter(n => Number.isFinite(n) && n >= 0 && n <= 100);
  if (!valid.length || questionCount < 1) return null;
  return Math.round(
    ((valid.reduce((a, b) => a + b, 0) / valid.length) *
      Math.min(valid.length, evaluatedCount)) /
      questionCount
  );
}
export function shouldRunOnce(
  state: { status?: string; runDate?: string },
  date: string
) {
  return state.status === "completed" && state.runDate === date;
}
export function verifyScheduledAuthorization(
  authorization: string | undefined,
  expectedSecret: string | undefined
): boolean {
  const prefix = "Bearer ";
  if (!expectedSecret || !authorization?.startsWith(prefix)) return false;
  const supplied = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(expectedSecret);
  return (
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}
export function isValidScheduledTaskUid(taskUid: string | undefined): taskUid is string {
  return (
    typeof taskUid === "string" &&
    /^[a-zA-Z0-9._:-]{1,128}$/.test(taskUid)
  );
}
let sharedPool: Pool | undefined;
function dbPool() {
  if (!sharedPool) {
    sharedPool = new Pool({
      ...verifiedPostgresOptions(process.env),
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    sharedPool.on("error", err => {
      console.warn(
        "Database pool client error (recovered):",
        err instanceof Error ? err.message : String(err)
      );
    });
  }
  return sharedPool;
}
function sanitizedError(e: unknown) {
  const m = e instanceof Error ? e.message.toLowerCase() : "";
  return /timeout|timed out|abort/.test(m)
    ? "Provider or database operation timed out"
    : /duplicate|unique/.test(m)
      ? "Duplicate data was skipped or rejected"
      : "Scheduled operation failed; diagnostic details withheld";
}
export function createScheduledCallback(adapters: WorkAdapters) {
  return async (req: Request, res: Response) => {
    let client: PoolClient | undefined;
    let taskLockAcquired = false;
    let taskUid: string | undefined;
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const expectedSecret = process.env.SCHEDULER_SHARED_SECRET?.trim();
      if (!expectedSecret || expectedSecret.length < 32) {
        res.status(503).json({ error: "Scheduled work is not configured" });
        return;
      }
      if (
        !verifyScheduledAuthorization(
          req.headers.authorization,
          expectedSecret
        )
      ) {
        res.status(401).json({ error: "Unauthorized scheduled request" });
        return;
      }
      if (
        req.body !== undefined &&
        (!req.body ||
          typeof req.body !== "object" ||
          Array.isArray(req.body) ||
          Object.keys(req.body).length > 0)
      ) {
        res.status(400).json({ error: "Scheduled request body must be empty" });
        return;
      }
      taskUid = req.header("x-scheduled-task-uid");
      if (!isValidScheduledTaskUid(taskUid)) {
        res.status(400).json({ error: "Invalid scheduled task identifier" });
        return;
      }
      const pool = adapters.pool ?? dbPool();
      client = await pool.connect();
      const task = await client.query(
        "select task_uid,job_type,active from public.scheduled_job_registry where task_uid=$1",
        [taskUid]
      );
      if (!task.rowCount || !task.rows[0].active) {
        res.status(404).json({ error: "Scheduled task unavailable" });
        return;
      }
      const taskLock = await client.query(
        "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked",
        [`scheduled-task:${taskUid}`]
      );
      taskLockAcquired = Boolean(taskLock.rows[0]?.locked);
      if (!taskLockAcquired) {
        res.status(200).json({ status: "already-running" });
        return;
      }
      const type = task.rows[0].job_type as string;
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const minuteKey = `${date}T${now.toISOString().slice(11, 16)}Z`;
      const run = await client.query(
        "insert into public.scheduled_job_runs(task_uid,run_key,status,started_at) values($1,$2,'running',now()) on conflict(task_uid,run_key) do update set status='running',started_at=now(),finished_at=null,error_summary=null where scheduled_job_runs.status='failed' or (scheduled_job_runs.status='running' and scheduled_job_runs.started_at < now() - interval '15 minutes') returning id",
        [
          taskUid,
          type === "question_bank_refresh"
            ? date
            : minuteKey,
        ]
      );
      if (!run.rowCount) {
        res.status(200).json({ status: "already-running-or-completed" });
        return;
      }
      const runId = run.rows[0].id;
      try {
        let processedCount = 0;
        if (type === "question_bank_refresh") {
          const result = await withGeminiUser(SCHEDULED_GEMINI_SUBJECT, () =>
            refreshQuestionBank(adapters, {
              pool,
              taskUid,
              runId,
            })
          );
          processedCount = result.inserted;
        } else if (type === "deadline_finalizer") {
          const result = await finalizeExpiredSessions(adapters, pool);
          processedCount = result.completed;
        } else {
          throw new Error("Unsupported scheduled task type");
        }
        await pool.query(
          "update public.scheduled_job_runs set status='completed',finished_at=now(),processed_count=$2 where id=$1",
          [runId, processedCount]
        );
      } catch (e) {
        await pool.query(
          "update public.scheduled_job_runs set status='failed',finished_at=now(),error_summary=$2 where id=$1",
          [runId, sanitizedError(e)]
        );
        throw e;
      }
      res.status(200).json({ status: "completed" });
    } catch (e) {
      console.error("Scheduled callback failed", sanitizedError(e));
      if (!res.headersSent)
        res.status(500).json({ error: "Scheduled work failed" });
    } finally {
      if (client && taskLockAcquired && taskUid) {
        await client
          .query(
            "select pg_advisory_unlock(hashtextextended($1, 0))",
            [`scheduled-task:${taskUid}`]
          )
          .catch(error =>
            console.error(
              "Scheduled task lock release failed",
              sanitizedError(error)
            )
          );
      }
      client?.release();
    }
  };
}
export async function refreshQuestionBank(
  adapters: WorkAdapters,
  opts: { pool?: Pool; taskUid?: string; runId?: string } = {}
) {
  const pool = opts.pool ?? adapters.pool ?? dbPool();
  const client = await pool.connect();
  let lockAcquired = false;
  let transactionOpen = false;
  try {
    const got = await client.query(
      "select pg_try_advisory_lock(hashtextextended('question_bank_refresh', 0)) as locked"
    );
    lockAcquired = Boolean(got.rows[0]?.locked);
    if (!lockAcquired)
      throw new Error("A question-bank refresh is already running.");
    const model = AI_MODEL;
    const generated = await adapters.generateQuestions({ count: 24, model });
    const valid = generated.filter(
      q =>
        q.question?.trim().length >= 20 &&
        q.question.length <= 2000 &&
        q.topic?.trim().length > 0 &&
        q.topic?.length <= 160 &&
        q.rationale?.trim().length > 0 &&
        q.rationale?.length <= 500 &&
        ["Easy", "Medium", "Hard"].includes(q.difficulty) &&
        COURSE_CATEGORY_SLUGS.has(q.category) &&
        QUESTION_CATEGORY_NAMES.has(q.questionCategory) &&
        INTERVIEW_TYPE_NAMES.has(q.interviewType) &&
        q.course?.length <= 120 &&
        q.role?.length <= 160 &&
        q.course.trim().length > 0 &&
        q.role.trim().length > 0
    );
    if (generated.length !== 24 || valid.length !== generated.length)
      throw new Error("Generated question batch failed schema validation");
    const recent = await client.query(
      "select question_text from public.question_bank where active=true order by created_at desc limit 1000"
    );
    const unique = filterDuplicateQuestions(
      valid,
      recent.rows.map(r => r.question_text)
    );
    const balanced = balanceQuestionBank(unique, 18);
    const countBy = (field: "category" | "difficulty") =>
      new Set(balanced.map(q => q[field].toLowerCase())).size;
    if (
      balanced.length < 12 ||
      countBy("category") < 6 ||
      countBy("difficulty") < 3
    )
      throw new Error("Generated question batch failed balance validation");

    await client.query("begin");
    transactionOpen = true;
    let inserted = 0;
    for (const q of balanced) {
      const r = await client.query(
        "insert into public.question_bank(course_category,course_names,topic,question_text,role,interview_type,difficulty,question_category,active,source,source_run_id,rationale) values($1,$2,$3,$4,$5,$6,$7,$8,true,'generated',$9,$10) on conflict(question_text) do nothing returning id",
        [
          q.category,
          [q.course],
          q.topic,
          q.question,
          q.role,
          q.interviewType,
          q.difficulty,
          q.questionCategory,
          opts.runId ?? null,
          q.rationale,
        ]
      );
      inserted += r.rowCount ?? 0;
    }
    if (opts.runId)
      await client.query(
        "update public.scheduled_job_runs set model=$2,prompt_version=$3,generated_count=$4,inserted_count=$5 where id=$1",
        [
          opts.runId,
          model,
          QUESTION_PROMPT_VERSION,
          generated.length,
          inserted,
        ]
      );
    await client.query("commit");
    transactionOpen = false;
    return { inserted, skipped: false, model };
  } catch (e) {
    if (transactionOpen) await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    if (lockAcquired)
      await client
        .query(
          "select pg_advisory_unlock(hashtextextended('question_bank_refresh', 0))"
        )
        .catch(() => undefined);
    client.release();
  }
}
export async function invokeAdminQuestionRefresh(adapters: WorkAdapters) {
  const pool = adapters.pool ?? dbPool();
  const taskUid = "internal-admin-question-refresh";
  const runKey = `manual:${crypto.randomUUID()}`;
  await pool.query(
    "insert into public.scheduled_job_registry(task_uid,job_type,active) values($1,'question_bank_refresh',true) on conflict(task_uid) do nothing",
    [taskUid]
  );
  const row = await pool.query(
    "insert into public.scheduled_job_runs(task_uid,run_key,status,started_at) values($1,$2,'running',now()) returning id",
    [taskUid, runKey]
  );
  try {
    const result = await refreshQuestionBank(adapters, {
        pool,
        taskUid,
        runId: row.rows[0].id,
      });
    await pool.query(
      "update public.scheduled_job_runs set status='completed',finished_at=now() where id=$1",
      [row.rows[0].id]
    );
    return result;
  } catch (e) {
    await pool.query(
      "update public.scheduled_job_runs set status='failed',finished_at=now(),error_summary=$2 where id=$1",
      [row.rows[0].id, sanitizedError(e)]
    );
    throw new Error(
      "Question-bank refresh failed; prior curated questions remain available."
    );
  }
}
export async function finalizeExpiredSessions(
  adapters: WorkAdapters,
  pool = adapters.pool ?? dbPool(),
  now = new Date()
) {
  const simple = await pool.query(
    "select * from public.interview_sessions where status='in_progress' and created_at + make_interval(mins=>duration_minutes) <= $1 order by created_at limit 10",
    [now]
  );
  const live = await pool.query(
    "select * from public.live_interview_sessions where status in ('in_progress','failed','finalizing') and deadline_at <= $1 order by deadline_at limit 10",
    [now]
  );
  let completed = 0;
  for (const s of simple.rows) {
    const claimToken = await claimSessionForFinalization(pool, "simple", s.id);
    if (!claimToken) continue;
    try {
      await withGeminiUser(s.owner_id, () =>
        finalizeSimple(adapters, pool, s, claimToken)
      );
      completed++;
    } catch (e) {
      await release(pool, "simple", s.id, claimToken, sanitizedError(e));
    }
  }
  for (const s of live.rows) {
    const claimToken = await claimSessionForFinalization(pool, "live", s.id);
    if (!claimToken) continue;
    try {
      await withGeminiUser(s.owner_id, () =>
        finalizeLive(adapters, pool, s, claimToken)
      );
      completed++;
    } catch (e) {
      await release(pool, "live", s.id, claimToken, sanitizedError(e));
    }
  }
  return { completed };
}
export async function claimSessionForFinalization(
  pool: Pool,
  kind: "simple" | "live",
  id: string
): Promise<string | null> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    const eligible =
      kind === "simple"
        ? await client.query(
            "select id from public.interview_sessions where id=$1 and status='in_progress' and created_at + make_interval(mins => duration_minutes) <= clock_timestamp() for update",
            [id]
          )
        : await client.query(
            "select id from public.live_interview_sessions where id=$1 and status in ('in_progress','failed','finalizing') and deadline_at <= clock_timestamp() for update",
            [id]
          );
    if (eligible.rowCount !== 1) {
      await client.query("rollback");
      transactionOpen = false;
      return null;
    }

    const result = await client.query(
      "insert into public.scheduled_finalizer_claims(session_kind,session_id,lease_until,lease_token) values($1,$2,clock_timestamp()+interval '20 minutes',gen_random_uuid()) on conflict(session_kind,session_id) do update set lease_until=excluded.lease_until,lease_token=gen_random_uuid(),last_error=null,updated_at=clock_timestamp() where scheduled_finalizer_claims.lease_until < clock_timestamp() returning lease_token",
      [kind, id]
    );
    const token = result.rows[0]?.lease_token ?? null;
    await client.query("commit");
    transactionOpen = false;
    return token;
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
async function release(
  pool: Pool,
  kind: string,
  id: string,
  claimToken: string,
  error: string
) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    if (kind === "simple")
      await client.query(
        "select id from public.interview_sessions where id=$1 for update",
        [id]
      );
    else
      await client.query(
        "select id from public.live_interview_sessions where id=$1 for update",
        [id]
      );
    const owned = await client.query(
      "select session_id from public.scheduled_finalizer_claims where session_kind=$1 and session_id=$2 and lease_token=$3 for update",
      [kind, id, claimToken]
    );
    if (!owned.rowCount) {
      await client.query("rollback");
      transactionOpen = false;
      return;
    }
    if (kind === "live")
      await client.query(
        "update public.live_interview_sessions set status='failed',report_error='Evaluation or report generation failed. Retry finalization.' where id=$1 and status='finalizing'",
        [id]
      );
    await client.query(
      "update public.scheduled_finalizer_claims set lease_until=clock_timestamp(),lease_token=null,last_error=$4,updated_at=clock_timestamp() where session_kind=$1 and session_id=$2 and lease_token=$3",
      [kind, id, claimToken, error]
    );
    await client.query("commit");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
async function finalizeSimple(
  a: WorkAdapters,
  p: Pool,
  s: any,
  claimToken: string
) {
  const answers = await p.query(
    "select a.*,q.question_text from public.interview_answers a join public.interview_questions q on q.id=a.question_id where a.session_id=$1 and a.created_at <= $2::timestamptz + make_interval(mins => $3::integer) order by q.sort_order",
    [s.id, s.created_at, Number(s.duration_minutes)]
  );
  const answerRows = answers.rows.filter(r => String(r.answer_text ?? "").trim());
  const answerIds = answerRows.map(row => row.id);
  const existingResult = answerIds.length
    ? await p.query(
        "select * from public.answer_evaluations where answer_id=any($1::uuid[])",
        [answerIds]
      )
    : { rows: [] as any[] };
  const existingByAnswer = new Map(
    existingResult.rows.map(e => [e.answer_id, e])
  );
  const candidates: Array<{
    answerId: string;
    result: Awaited<ReturnType<WorkAdapters["evaluate"]>>;
  }> = [];
  for (const row of answerRows) {
    if (existingByAnswer.has(row.id)) continue;
    const result = await a.evaluate({
      question: row.question_text,
      answer: row.answer_text,
      course: s.course,
      specialization: s.specialization,
      role: s.target_role,
      type: s.interview_type,
      skills: s.skills ?? [],
      language: s.language,
    });
    if (result.source !== "ai")
      throw new Error("A non-AI fallback cannot be stored as a scored evaluation.");
    candidates.push({ answerId: row.id, result });
  }

  if (candidates.length) {
    await withActiveFinalizationLease(p, "simple", s.id, claimToken, async tx => {
      const eligible = await tx.query(
        "select id from public.interview_sessions where id=$1 and status='in_progress' and created_at + make_interval(mins => duration_minutes) <= clock_timestamp() for update",
        [s.id]
      );
      requireExactlyOneRow(
        eligible.rowCount,
        "Simple interview is no longer eligible for deadline finalization."
      );
      for (const { answerId, result } of candidates) {
        await tx.query(
          "insert into public.answer_evaluations(owner_id,answer_id,overall_score,dimensions,strengths,weaknesses,missing_points,better_answer,improvement_tip,source,model_version,prompt_version,rubric_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(answer_id) do nothing",
          [
            s.owner_id,
            answerId,
            result.overall_score,
            JSON.stringify(result.dimensions),
            JSON.stringify(result.strengths),
            JSON.stringify(result.weaknesses),
            JSON.stringify(result.missing_points),
            result.better_answer,
            result.improvement_tip,
            result.source,
            result.modelVersion,
            result.promptVersion,
            result.rubricVersion,
          ]
        );
      }
    });
  }
  const persistedResult = answerIds.length
    ? await p.query(
        "select * from public.answer_evaluations where answer_id=any($1::uuid[])",
        [answerIds]
      )
    : { rows: [] as any[] };
  const evaluations = persistedResult.rows;
  const actualEvaluations = evaluations.filter(e => e.source === "ai");
  const score = completionAdjustedScore(
    actualEvaluations.map(e => Number(e.overall_score)),
    actualEvaluations.length,
    Number(s.question_count)
  );
  const answerById = new Map(answers.rows.map(row => [row.id, row]));
  const analysisAnswers = actualEvaluations
    .map(e => {
      const answer = answerById.get(e.answer_id);
      if (!answer) return null;
      return {
        question: answer.question_text,
        answer: answer.answer_text,
        score: Number(e.overall_score),
      };
    })
    .filter(
      (answer): answer is { question: string; answer: string; score: number } =>
        answer !== null
    )
    .slice(0, 12);
  const analysisSource = analysisAnswers.length ? "ai" : "transparent-baseline";
  const analysis = analysisAnswers.length
    ? await a.analyze({
        course: s.course,
        role: s.target_role,
        answers: analysisAnswers,
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
  const report = {
    version: "simple-report-v2",
    role: s.target_role,
    course: s.course,
    startedAt: new Date(s.created_at).toISOString(),
    deadlineAt: new Date(
      new Date(s.created_at).getTime() + Number(s.duration_minutes) * 60_000
    ).toISOString(),
    durationMinutes: Number(s.duration_minutes),
    completedAt: new Date().toISOString(),
    completionReason: "deadline",
    questionCount: Number(s.question_count),
    answeredCount: answers.rows.filter(r => String(r.answer_text ?? "").trim()).length,
    evaluatedCount: actualEvaluations.length,
    overallScore: score,
    evaluationModelVersion: actualEvaluations[0]?.model_version ?? null,
    evaluationPromptVersion: actualEvaluations[0]?.prompt_version ?? null,
    rubricVersion: actualEvaluations[0]?.rubric_version ?? null,
    analysisSource,
    analysisModelVersion: analysis.modelVersion ?? null,
    analysisPromptVersion: analysis.promptVersion ?? null,
    summary: analysis.summary,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    communication_issues: analysis.communication_issues,
    repeated_mistakes: analysis.repeated_mistakes,
    missing_concepts: analysis.missing_concepts,
    next_steps: analysis.next_steps,
    analysis,
    evaluations,
  };
  const completedAt = new Date(report.completedAt);
  await withActiveFinalizationLease(p, "simple", s.id, claimToken, async tx => {
    const status = await tx.query(
      "update public.interview_sessions set status='completed',overall_score=$2,completed_at=$3,duration_seconds=greatest(0,floor(extract(epoch from ($3::timestamptz-created_at)))::integer) where id=$1 and status='in_progress' and created_at + make_interval(mins => duration_minutes) <= clock_timestamp() returning id",
      [s.id, score, completedAt]
    );
    requireExactlyOneRow(
      status.rowCount,
      "Simple interview status changed before its report could be committed."
    );
    const reportWrite = await tx.query(
      "insert into public.interview_reports(owner_id,session_id,analysis) values($1,$2,$3) on conflict(session_id) do nothing returning session_id",
      [s.owner_id, s.id, JSON.stringify(report)]
    );
    requireExactlyOneRow(
      reportWrite.rowCount,
      "Simple Interview report could not be committed for its owner."
    );
    const pinned = await tx.query(
      "update public.scheduled_finalizer_claims set lease_until='infinity'::timestamptz,last_error=null,updated_at=clock_timestamp() where session_kind='simple' and session_id=$1 and lease_token=$2 returning session_id",
      [s.id, claimToken]
    );
    requireExactlyOneRow(
      pinned.rowCount,
      "Simple interview finalization lease was lost before report commit."
    );
  });
}
async function finalizeLive(
  a: WorkAdapters,
  p: Pool,
  s: any,
  claimToken: string
) {
  await withActiveFinalizationLease(p, "live", s.id, claimToken, async tx => {
    const transition = await tx.query(
      "update public.live_interview_sessions set status='finalizing',report_error=null where id=$1 and status in ('in_progress','failed','finalizing') and deadline_at <= clock_timestamp() returning *",
      [s.id]
    );
    requireExactlyOneRow(
      transition.rowCount,
      "Live Interview status changed before deadline finalization began."
    );
    Object.assign(s, transition.rows[0]);
  });

  const turns = await p.query(
    "select * from public.live_interview_turns where session_id=$1 order by turn_index",
    [s.id]
  );
  const pending: Array<{
    turnId: string;
    evaluation: Awaited<ReturnType<WorkAdapters["evaluate"]>>;
  }> = [];
  for (const turn of turns.rows) {
    if (
      !turn.transcript ||
      turn.transcript_status !== "accepted" ||
      (turn.evaluation_status === "completed" && turn.evaluation?.source === "ai")
    )
      continue;
    const evaluation = await a.evaluate({
      question: turn.question_text,
      answer: turn.transcript,
      course: "General interview preparation",
      role: s.target_role,
      type: turn.question_type,
      skills: Array.isArray(turn.competencies) ? turn.competencies : [],
      language: s.speech_language,
    });
    if (evaluation.source !== "ai")
      throw new Error("A non-AI fallback cannot be stored as a scored evaluation.");
    pending.push({ turnId: turn.id, evaluation });
  }

  if (pending.length) {
    await withActiveFinalizationLease(p, "live", s.id, claimToken, async tx => {
      const session = await tx.query(
        "select id from public.live_interview_sessions where id=$1 and status='finalizing' and deadline_at <= clock_timestamp() for update",
        [s.id]
      );
      requireExactlyOneRow(
        session.rowCount,
        "Live Interview is no longer eligible for deadline finalization."
      );
      for (const item of pending) {
        const saved = await tx.query(
          "update public.live_interview_turns set evaluation=$4,evaluation_status='completed' where id=$1 and session_id=$2 and owner_id=$3 and transcript_status='accepted' and transcript is not null and evaluation_status <> 'completed' returning id",
          [item.turnId, s.id, s.owner_id, JSON.stringify(item.evaluation)]
        );
        requireExactlyOneRow(
          saved.rowCount,
          "Live turn state changed before its evaluation could be saved."
        );
      }
    });
  }

  const persistedTurns = await p.query(
    "select * from public.live_interview_turns where session_id=$1 order by turn_index",
    [s.id]
  );
  const scored = persistedTurns.rows.filter(
    t =>
      t.transcript_status === "accepted" &&
      t.evaluation_status === "completed" &&
      t.evaluation?.source === "ai"
  );
  const analysis = scored.length
    ? await a.analyze({
        course: "General interview preparation",
        role: s.target_role,
        answers: scored
          .slice(0, 8)
          .map(t => ({
            question: t.question_text,
            answer: t.transcript,
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
  const report = {
    version: "live-report-v2",
    role: s.target_role,
    durationMinutes: s.duration_minutes,
    startedAt: s.started_at,
    deadlineAt: s.deadline_at,
    completedAt: new Date().toISOString(),
    completionReason: "deadline",
    questionCount: persistedTurns.rowCount,
    answeredCount: persistedTurns.rows.filter(
      t => t.transcript_status === "accepted" && t.transcript
    ).length,
    evaluatedCount: scored.length,
    answerQualityScore: scored.length
      ? Math.round(
          scored.reduce(
            (sum, t) => sum + Number(t.evaluation.overall_score),
            0
          ) / scored.length
        )
      : null,
    evaluationModelVersion: scored[0]?.evaluation.modelVersion ?? null,
    evaluationPromptVersion: scored[0]?.evaluation.promptVersion ?? null,
    rubricVersion: scored[0]?.evaluation.rubricVersion ?? null,
    analysisSource: scored.length ? "ai" : "transparent-baseline",
    analysisModelVersion: analysis.modelVersion ?? null,
    analysisPromptVersion: analysis.promptVersion ?? null,
    analysis,
    turns: persistedTurns.rows.map(t => ({
      id: t.id,
      question: t.question_text,
      questionType: t.question_type,
      difficulty: t.difficulty,
      transcript: t.transcript,
      transcriptStatus: t.transcript_status,
      evaluation: t.evaluation_status === "completed" ? t.evaluation : null,
      evaluationStatus: t.evaluation_status,
    })),
    cameraSummary: s.camera_summary ?? null,
    limitations: [
      "Speech recognition is browser-provided; quality varies by browser, language, accent and environment.",
      "AI scores are coaching estimates, not validated hiring metrics.",
      "Narrative summary uses up to 12 answers; per-turn evaluation is retained for all turns.",
      "Camera summary, when available, is optional factual framing feedback and never affects answer-quality scores.",
    ],
  };
  const completedAt = new Date(report.completedAt);
  await withActiveFinalizationLease(p, "live", s.id, claimToken, async tx => {
    const status = await tx.query(
      "update public.live_interview_sessions set status='completed',report=$2,report_error=null,completed_at=$3 where id=$1 and status='finalizing' and deadline_at <= clock_timestamp() returning id",
      [s.id, JSON.stringify(report), completedAt]
    );
    requireExactlyOneRow(
      status.rowCount,
      "Live Interview status changed before its report could be committed."
    );
    const pinned = await tx.query(
      "update public.scheduled_finalizer_claims set lease_until='infinity'::timestamptz,last_error=null,updated_at=clock_timestamp() where session_kind='live' and session_id=$1 and lease_token=$2 returning session_id",
      [s.id, claimToken]
    );
    requireExactlyOneRow(
      pinned.rowCount,
      "Live Interview finalization lease was lost before report commit."
    );
  });
}
