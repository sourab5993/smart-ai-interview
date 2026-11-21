export function productionConfigIssues(env: NodeJS.ProcessEnv): string[] {
  if (env.NODE_ENV !== "production") return [];

  const issues: string[] = [];
  const supabaseUrl = env.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    issues.push("SUPABASE_URL");
  } else {
    try {
      if (new URL(supabaseUrl).protocol !== "https:")
        issues.push("SUPABASE_URL (must use HTTPS)");
    } catch {
      issues.push("SUPABASE_URL (must be a valid URL)");
    }
  }

  const publicKey = env.SUPABASE_ANON_KEY?.trim();
  if (!publicKey) {
    issues.push("SUPABASE_ANON_KEY");
  } else if (
    publicKey.startsWith("sb_secret_") ||
    (publicKey.split(".").length === 3 &&
      decodeJwtRole(publicKey) === "service_role")
  ) {
    issues.push("SUPABASE_ANON_KEY (must not be a service-role key)");
  }

  if (!env.GEMINI_API_KEY?.trim()) issues.push("GEMINI_API_KEY");
  if (!env.SUPABASE_DB_URL?.trim())
    issues.push("SUPABASE_DB_URL (required for shared Gemini rate limiting)");
  const schedulerSecret = env.SCHEDULER_SHARED_SECRET?.trim();
  if (schedulerSecret && schedulerSecret.length < 32)
    issues.push("SCHEDULER_SHARED_SECRET (must be at least 32 characters)");

  for (const [key, maximum] of [
    ["GEMINI_RATE_LIMIT_WINDOW_SECONDS", 86_400],
    ["GEMINI_RATE_LIMIT_BURST", 100],
    ["GEMINI_RATE_LIMIT_QUESTION_GENERATION_PER_WINDOW", 10_000],
    ["GEMINI_RATE_LIMIT_ANSWER_EVALUATION_PER_WINDOW", 10_000],
    ["GEMINI_RATE_LIMIT_REPORT_GENERATION_PER_WINDOW", 10_000],
    ["GEMINI_RATE_LIMIT_AUDIO_TRANSCRIPTION_PER_WINDOW", 10_000],
    ["GEMINI_RATE_LIMIT_RESUME_ANALYSIS_PER_WINDOW", 10_000],
    ["GEMINI_RATE_LIMIT_JOB_MATCH_PER_WINDOW", 10_000],
    ["GEMINI_RATE_LIMIT_STUDY_PLAN_PER_WINDOW", 10_000],
    ["GEMINI_RATE_LIMIT_QUESTION_EXPLANATION_PER_WINDOW", 10_000],
  ] as const) {
    const value = env[key]?.trim();
    if (
      value &&
      (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum)
    )
      issues.push(`${key} (must be between 1 and ${maximum})`);
  }

  const port = env.PORT?.trim();
  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535))
    issues.push("PORT (must be an integer from 1 to 65535)");

  return issues;
}

function decodeJwtRole(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const value: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    return value && typeof value === "object" && "role" in value
      ? String(value.role)
      : undefined;
  } catch {
    return undefined;
  }
}
