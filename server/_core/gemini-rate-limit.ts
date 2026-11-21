import { AsyncLocalStorage } from "node:async_hooks";
import { TRPCError } from "@trpc/server";
import { Pool } from "pg";
import { verifiedPostgresOptions } from "./database";

export const GEMINI_OPERATIONS = [
  "question_generation",
  "answer_evaluation",
  "report_generation",
  "audio_transcription",
  "resume_analysis",
  "job_match",
  "study_plan",
  "question_explanation",
] as const;

export type GeminiOperation = (typeof GEMINI_OPERATIONS)[number];
type Queryable = Pick<Pool, "query">;

const operationPolicies: Record<
  GeminiOperation,
  { envName: string; defaultLimit: number }
> = {
  question_generation: {
    envName: "GEMINI_RATE_LIMIT_QUESTION_GENERATION_PER_WINDOW",
    defaultLimit: 30,
  },
  answer_evaluation: {
    envName: "GEMINI_RATE_LIMIT_ANSWER_EVALUATION_PER_WINDOW",
    defaultLimit: 90,
  },
  report_generation: {
    envName: "GEMINI_RATE_LIMIT_REPORT_GENERATION_PER_WINDOW",
    defaultLimit: 20,
  },
  audio_transcription: {
    envName: "GEMINI_RATE_LIMIT_AUDIO_TRANSCRIPTION_PER_WINDOW",
    defaultLimit: 30,
  },
  resume_analysis: {
    envName: "GEMINI_RATE_LIMIT_RESUME_ANALYSIS_PER_WINDOW",
    defaultLimit: 15,
  },
  job_match: {
    envName: "GEMINI_RATE_LIMIT_JOB_MATCH_PER_WINDOW",
    defaultLimit: 20,
  },
  study_plan: {
    envName: "GEMINI_RATE_LIMIT_STUDY_PLAN_PER_WINDOW",
    defaultLimit: 20,
  },
  question_explanation: {
    envName: "GEMINI_RATE_LIMIT_QUESTION_EXPLANATION_PER_WINDOW",
    defaultLimit: 60,
  },
};

const userContext = new AsyncLocalStorage<string>();
let sharedPool: Pool | undefined;

export function withGeminiUser<T>(
  userId: string,
  action: () => T
): T {
  return userContext.run(userId, action);
}

export const SCHEDULED_GEMINI_SUBJECT =
  "00000000-0000-4000-8000-000000000001";

function getPool() {
  return (sharedPool ??= new Pool({
    ...verifiedPostgresOptions(process.env),
    max: 4,
  }));
}

function positiveInteger(
  envName: string,
  fallback: number,
  max: number
): number {
  const raw = process.env[envName]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${envName} must be a positive integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new Error(`${envName} must be between 1 and ${max}.`);
  return value;
}

export function getGeminiRateLimitPolicy(operation: GeminiOperation) {
  const policy = operationPolicies[operation];
  return {
    limit: positiveInteger(policy.envName, policy.defaultLimit, 10_000),
    windowSeconds: positiveInteger(
      "GEMINI_RATE_LIMIT_WINDOW_SECONDS",
      3600,
      86_400
    ),
    burst: positiveInteger("GEMINI_RATE_LIMIT_BURST", 5, 100),
  };
}

export async function enforceGeminiRateLimit(
  operation: GeminiOperation,
  options: { userId?: string; pool?: Queryable } = {}
): Promise<void> {
  const userId = options.userId ?? userContext.getStore();
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "An authenticated account is required for AI requests.",
    });

  const policy = getGeminiRateLimitPolicy(operation);
  let rows: Array<{ allowed: boolean; retry_after_seconds: number }>;
  try {
    const result = await (options.pool ?? getPool()).query<{
      allowed: boolean;
      retry_after_seconds: number;
    }>(
      "select allowed, retry_after_seconds from public.consume_gemini_rate_limit($1, $2, $3, $4, $5)",
      [
        userId,
        operation,
        policy.limit,
        policy.windowSeconds,
        policy.burst,
      ]
    );
    rows = result.rows;
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "AI requests are temporarily unavailable. Please try again later.",
    });
  }

  const result = rows[0];
  if (!result || typeof result.allowed !== "boolean")
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "AI request limits are temporarily unavailable.",
    });
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil(Number(result.retry_after_seconds) || 1));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `AI request limit reached. Try again in about ${retryAfter} seconds.`,
    });
  }
}
