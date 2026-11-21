import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  enforceGeminiRateLimit,
  getGeminiRateLimitPolicy,
  withGeminiUser,
} from "./gemini-rate-limit";

const userId = "123e4567-e89b-42d3-a456-426614174000";

describe("shared Gemini rate limiting", () => {
  it("uses the authenticated async context and calls the shared database bucket", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ allowed: true, retry_after_seconds: 0 }],
    });

    await expect(
      withGeminiUser(userId, () =>
        enforceGeminiRateLimit("answer_evaluation", {
          pool: { query } as never,
        })
      )
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("consume_gemini_rate_limit"),
      [userId, "answer_evaluation", 90, 3600, 5]
    );
  });

  it("does not allow a request without a server-verified user identity", async () => {
    const query = vi.fn();

    await expect(
      enforceGeminiRateLimit("question_generation", { pool: { query } as never })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(query).not.toHaveBeenCalled();
  });

  it("returns a retry indication when the shared bucket is empty", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ allowed: false, retry_after_seconds: 14 }],
    });

    await expect(
      withGeminiUser(userId, () =>
        enforceGeminiRateLimit("audio_transcription", {
          pool: { query } as never,
        })
      )
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringContaining("14 seconds"),
    });
  });

  it("fails closed without leaking database errors", async () => {
    const query = vi.fn().mockRejectedValue(new Error("private connection detail"));

    const error = await withGeminiUser(userId, () =>
      enforceGeminiRateLimit("report_generation", {
        pool: { query } as never,
      })
    ).catch(value => value);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error.message).toContain("temporarily unavailable");
    expect(error.message).not.toContain("private connection detail");
  });

  it("allows explicit per-operation policy configuration within safe bounds", () => {
    vi.stubEnv("GEMINI_RATE_LIMIT_WINDOW_SECONDS", "900");
    vi.stubEnv("GEMINI_RATE_LIMIT_BURST", "3");
    vi.stubEnv("GEMINI_RATE_LIMIT_QUESTION_GENERATION_PER_WINDOW", "12");

    expect(getGeminiRateLimitPolicy("question_generation")).toEqual({
      limit: 12,
      windowSeconds: 900,
      burst: 3,
    });

    vi.unstubAllEnvs();
  });

  it("keeps the additive migration server-only and defines atomic bounded consumption", async () => {
    const migration = await readFile(
      new URL("../../supabase/migrations/202611100001_gemini_rate_limits.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain("create table if not exists public.gemini_rate_limit_buckets");
    expect(migration).toContain("for update");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.gemini_rate_limit_buckets from public, anon, authenticated");
    expect(migration).toContain("revoke all on function public.consume_gemini_rate_limit");
  });
});
