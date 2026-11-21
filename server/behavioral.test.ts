import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeBehavioralSession,
  createBehavioralSession,
  getBehavioralSession,
  saveBehavioralAnswer,
} from "./behavioral";

const ctx = {
  user: { id: "owner-1" },
  accessToken: "session-token",
} as any;

function response(body: unknown, status = 200) {
  return new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let previousUrl: string | undefined;
let previousKey: string | undefined;

beforeEach(() => {
  previousUrl = process.env.SUPABASE_URL;
  previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_ANON_KEY = "public-test-key";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (previousUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = previousKey;
});

describe("behavioral backend ownership and lifecycle", () => {
  it("scopes source questions and sessions to the signed-in owner when creating a session", async () => {
    fetchMock
      .mockResolvedValueOnce(response([{ id: "q-1", session_id: "s-1", question_text: "Question", topic: "Topic", difficulty: "Medium", rationale: "Why", sort_order: 0 }]))
      .mockResolvedValueOnce(response([{ id: "s-1" }]))
      .mockResolvedValueOnce(response([{ id: "behavioral-1" }], 201))
      .mockResolvedValueOnce(response(null, 201));

    const result = await createBehavioralSession(ctx, {
      selectedQuestions: [{ sourceSessionId: "s-1", sourceQuestionId: "q-1" }],
      generatedQuestions: [],
      includeAnswerEvaluation: false,
      consent: { accepted: true },
      modelMetadata: { version: "test" },
    });

    expect(result.id).toBe("behavioral-1");
    const requests = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(requests[0][0]).toContain("interview_questions?owner_id=eq.owner-1");
    expect(requests[1][0]).toContain("interview_sessions?owner_id=eq.owner-1");
    expect(requests.every(([, init]) => (init.headers as Record<string, string>).Authorization === "Bearer session-token")).toBe(true);
    const persistedQuestions = JSON.parse(String(requests[3][1].body));
    expect(persistedQuestions[0]).toMatchObject({
      owner_id: "owner-1",
      behavioral_session_id: "behavioral-1",
      source_question_id: "q-1",
      question_text: "Question",
      topic: "Topic",
      difficulty: "Medium",
      rationale: "Why",
    });
  });

  it("rejects source questions unavailable to the current owner before creating anything", async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    await expect(createBehavioralSession(ctx, {
      selectedQuestions: [{ sourceSessionId: "foreign-session", sourceQuestionId: "foreign-question" }],
      generatedQuestions: [],
      includeAnswerEvaluation: false,
      consent: {},
      modelMetadata: {},
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not leak raw Supabase failures through user-visible errors", async () => {
    fetchMock.mockResolvedValueOnce(response({ message: "internal host and key detail" }, 500));
    const error = await getBehavioralSession(ctx, "behavioral-1").catch(value => value);
    expect(error).toBeInstanceOf(TRPCError);
    expect(error.message).not.toContain("internal host");
    expect(error.message).toMatch(/temporarily unavailable/i);
  });

  it("keeps the incomplete-answer precondition inside the completion RPC and hides database details", async () => {
    fetchMock.mockResolvedValueOnce(response({ message: "Every behavioral question must have a saved answer" }, 409));

    const error = await completeBehavioralSession(ctx, "behavioral-1").catch(value => value);
    expect(error).toBeInstanceOf(TRPCError);
    expect(error.message).not.toContain("Every behavioral question");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/complete_behavioral_session");
  });

  it("requests one atomic completion and returns the database-recomputed summary", async () => {
    const savedSummary = { behavioralScore: null, insufficientData: true };
    fetchMock.mockResolvedValueOnce(response(savedSummary));

    await expect(completeBehavioralSession(ctx, "behavioral-1")).resolves.toEqual({
      ...savedSummary,
      sessionId: "behavioral-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/complete_behavioral_session");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ p_session_id: "behavioral-1" });
  });

  it("rejects a blank transcript before sending any answer or observation data", async () => {
    await expect(saveBehavioralAnswer(ctx, {
      sessionId: "behavioral-1",
      questionId: "q-1",
      transcript: "   ",
      transcriptLanguage: "en",
      transcriptConfidence: null,
      durationSeconds: 2,
      startedAt: "2026-10-01T00:00:00.000Z",
      endedAt: "2026-10-01T00:00:02.000Z",
      observationSummary: {},
      observations: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends each answer and its bounded observations through one atomic owner-scoped RPC", async () => {
    fetchMock.mockResolvedValueOnce(response("a-1"));

    const result = await saveBehavioralAnswer(ctx, {
      sessionId: "behavioral-1",
      questionId: "q-1",
      transcript: "  My spoken answer  ",
      transcriptLanguage: "en",
      transcriptConfidence: 0.9,
      durationSeconds: 10,
      startedAt: "2026-10-01T00:00:00.000Z",
      endedAt: "2026-10-01T00:00:10.000Z",
      observationSummary: { behavioralScore: null },
      observations: [{ observedAtMs: 2000, observationType: "frame", payload: { faceVisible: true }, valid: true, reliability: 85 }],
    });

    expect(result.id).toBe("a-1");
    const requests = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(requests).toHaveLength(1);
    expect(requests[0][0]).toContain("/rest/v1/rpc/save_behavioral_answer");
    expect(requests[0][1].method).toBe("POST");
    const answerBody = JSON.parse(String(requests[0][1].body));
    expect(answerBody).toMatchObject({
      p_session_id: "behavioral-1",
      p_question_id: "q-1",
      p_transcript: "My spoken answer",
      p_transcript_language: "en",
      p_observations: [{ observed_at_ms: 2000, observation_type: "frame", payload: { faceVisible: true }, valid: true, reliability: 85 }],
    });
  });
});
