import { describe, expect, it, vi } from "vitest";
import {
  balanceQuestionBank,
  claimSessionForFinalization,
  completionAdjustedScore,
  filterDuplicateQuestions,
  isValidScheduledTaskUid,
  isExpiredInProgress,
  shouldRunOnce,
  verifyScheduledAuthorization,
} from "./scheduled-work";

describe("scheduled work pure guards", () => {
  it("authenticates scheduler callbacks with a constant-time bearer secret", () => {
    expect(verifyScheduledAuthorization("Bearer unit-secret", "unit-secret")).toBe(true);
    expect(verifyScheduledAuthorization("Bearer wrong-secret", "unit-secret")).toBe(false);
    expect(verifyScheduledAuthorization("unit-secret", "unit-secret")).toBe(false);
    expect(verifyScheduledAuthorization("Bearer unit-secret", undefined)).toBe(false);
  });
  it("accepts only bounded task identifiers suitable for registry lookup", () => {
    expect(isValidScheduledTaskUid("deadline-finalizer-v1")).toBe(true);
    expect(isValidScheduledTaskUid("x".repeat(129))).toBe(false);
    expect(isValidScheduledTaskUid("../other-task")).toBe(false);
    expect(isValidScheduledTaskUid(undefined)).toBe(false);
  });
  it("rejects exact and high-overlap near duplicates while retaining distinct prompts", () => {
    const result = filterDuplicateQuestions([
      { question: "How would you debug a slow database query in production?" },
      { question: "How would you debug a slow database query in production." },
      { question: "How would you investigate a delayed customer payment?" },
    ]);
    expect(result).toHaveLength(2);
  });
  it("balances persisted candidates across categories and difficulty levels", () => {
    const rows = ["engineering", "medical", "law"].flatMap(category =>
      ["Easy", "Medium", "Hard"].map(difficulty => ({ category, difficulty }))
    );
    const selected = balanceQuestionBank(rows, 9);
    expect(selected).toHaveLength(9);
    expect(new Set(selected.map(row => row.category)).size).toBe(3);
    expect(new Set(selected.map(row => row.difficulty)).size).toBe(3);
    expect(selected.every(row => rows.includes(row))).toBe(true);
  });
  it("recognizes completed daily ledger entries as idempotently done", () => {
    expect(
      shouldRunOnce(
        { status: "completed", runDate: "2026-10-24" },
        "2026-10-24"
      )
    ).toBe(true);
    expect(
      shouldRunOnce({ status: "failed", runDate: "2026-10-24" }, "2026-10-24")
    ).toBe(false);
  });
  it("requires persisted in-progress work to pass the server deadline", () => {
    const deadline = "2026-10-24T00:00:00Z";
    expect(
      isExpiredInProgress(
        "in_progress",
        deadline,
        Date.parse("2026-10-24T00:00:01Z")
      )
    ).toBe(true);
    expect(
      isExpiredInProgress(
        "completed",
        deadline,
        Date.parse("2026-10-24T00:00:01Z")
      )
    ).toBe(false);
    expect(
      isExpiredInProgress(
        "in_progress",
        deadline,
        Date.parse("2026-10-23T23:59:59Z")
      )
    ).toBe(false);
  });
  it("adjusts average evaluated answer quality for actual evaluated coverage only", () => {
    expect(completionAdjustedScore([80, 100], 2, 4)).toBe(45);
    expect(completionAdjustedScore([], 0, 4)).toBeNull();
    expect(completionAdjustedScore([80, 100], 2, 0)).toBeNull();
  });
});

describe("transactional finalizer claims", () => {
  it("locks the eligible parent session before inserting its lease", async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        if (sql.includes("from public.interview_sessions"))
          return { rowCount: 1, rows: [{ id: "session-1" }] };
        if (sql.includes("insert into public.scheduled_finalizer_claims"))
          return { rowCount: 1, rows: [{ lease_token: "lease-1" }] };
        return { rowCount: 1, rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as any;

    await expect(
      claimSessionForFinalization(pool, "simple", "session-1")
    ).resolves.toBe("lease-1");
    expect(statements[0]).toBe("begin");
    expect(statements[1]).toMatch(/from public\.interview_sessions[\s\S]*for update/i);
    expect(statements[2]).toMatch(/insert into public\.scheduled_finalizer_claims/i);
    expect(statements[3]).toBe("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("does not create a lease for a session that is no longer deadline-eligible", async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        if (sql.includes("from public.interview_sessions"))
          return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) } as any;

    await expect(
      claimSessionForFinalization(pool, "simple", "session-1")
    ).resolves.toBeNull();
    expect(statements[0]).toBe("begin");
    expect(statements[1]).toMatch(/created_at[\s\S]*clock_timestamp\(\)[\s\S]*for update/i);
    expect(statements).not.toContain(
      expect.stringMatching(/insert into public\.scheduled_finalizer_claims/i)
    );
    expect(statements.at(-1)).toBe("rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
