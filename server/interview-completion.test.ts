import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/notifications", () => ({
  notifyUser: vi.fn(),
  notifyWeeklyProgress: vi.fn(),
}));

import { persistInterviewCompletion } from "../client/src/lib/interview-completion";

const leaseToken = "a9abced0-9782-4f4c-a123-81d8d0ab1287";

function completionInput(client: any) {
  return {
    client,
    ownerId: "owner-1",
    session: {
      id: "session-1",
      owner_id: "owner-1",
      course: "Engineering",
      specialization: "Systems",
      target_role: "Engineer",
      interview_type: "Technical",
      difficulty: "Medium",
      created_at: "2026-10-25T00:00:00.000Z",
    },
    questions: [],
    answers: [],
    evaluations: {},
    summarize: vi.fn(),
  };
}

function emptyReadClient() {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: [], error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  return { from: vi.fn(() => query), query };
}

describe("shared Simple Interview finalizer lease", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not write reports when another finalizer owns the session", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn(),
    };

    await expect(
      persistInterviewCompletion(completionInput(client) as any)
    ).rejects.toThrow("already being finalized");
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("releases only its own lease after a retryable report-write failure", async () => {
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: leaseToken, error: null })
        .mockResolvedValueOnce({ data: true, error: null }),
      from: vi.fn(() => {
        throw new Error("report store unavailable");
      }),
    };

    await expect(
      persistInterviewCompletion(completionInput(client) as any)
    ).rejects.toThrow("report store unavailable");
    expect(client.rpc).toHaveBeenNthCalledWith(1, "claim_interview_finalization", {
      p_session_kind: "simple",
      p_session_id: "session-1",
    });
    expect(client.rpc).toHaveBeenNthCalledWith(
      2,
      "release_interview_finalization",
      expect.objectContaining({
        p_session_kind: "simple",
        p_session_id: "session-1",
        p_claim_token: leaseToken,
      })
    );
  });

  it("atomically commits an unscorable report with a NULL score", async () => {
    const reads = emptyReadClient();
    const client = {
      ...reads,
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: leaseToken, error: null })
        .mockResolvedValueOnce({ data: true, error: null }),
    };

    const result = await persistInterviewCompletion(
      completionInput(client) as any
    );

    expect(result.score).toBeNull();
    expect(client.rpc).toHaveBeenNthCalledWith(2,
      "complete_simple_interview_with_claim",
      expect.objectContaining({
        p_session_id: "session-1",
        p_claim_token: leaseToken,
        p_overall_score: null,
        p_report: expect.objectContaining({
          analysisSource: "transparent-baseline",
        }),
      })
    );
  });

  it("releases its lease and rejects another finalizer's terminal result", async () => {
    const reads = emptyReadClient();
    const client = {
      ...reads,
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: leaseToken, error: null })
        .mockResolvedValueOnce({ data: false, error: null })
        .mockResolvedValueOnce({ data: false, error: null }),
    };

    await expect(
      persistInterviewCompletion(completionInput(client) as any)
    ).rejects.toThrow("lease or session status changed");
    expect(client.rpc).toHaveBeenNthCalledWith(
      3,
      "release_interview_finalization",
      expect.objectContaining({ p_claim_token: leaseToken })
    );
  });
});
